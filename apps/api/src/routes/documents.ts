import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { documentos } from '../db/schema.js';
import { eq, and, or, desc, sql, gte, lte } from 'drizzle-orm';
import { consultarNFeporChave } from '@dfecentral/sdk';
import type { SdkConfig, TipoDocumento } from '@dfecentral/sdk';
import { buscarNoCache, salvarNoCache, docParaFiscal } from '../db/cache.js';
import { gerarPdfDanfe } from '../utils/danfe.js';
import { registrarConsulta } from '../db/audit.js';
import { arquivarXmlEmR2, enviarXmlContabilidadeAutomatico } from '../utils/contabilidade.js';

function tipoDaChave(chave: string): TipoDocumento | null {
  const modelo = chave.slice(20, 22);
  if (modelo === '55') return 'nfe';
  if (modelo === '65') return 'nfce';
  if (modelo === '57') return 'cte';
  if (modelo === '58') return 'mdfe';
  if (modelo === '63') return 'bpe';
  if (modelo === '67') return 'cteos';
  return null;
}

interface DocumentRouteOptions {
  tipo: string;
  label: string;
}

const TIPOS_SEM_CHAVE_44 = new Set(['nfse', 'dce']);

type Movimento = 'emitidas' | 'recebidas' | 'todas';

function normalizarMovimento(valor?: string): Movimento {
  if (valor === 'recebidas' || valor === 'todas') return valor;
  return 'emitidas';
}

function chaveValidaParaTipo(chave: string, tipo: string): boolean {
  if (tipo === 'nfse') return chave.length === 50;
  if (tipo === 'dce') return chave.length === 56;
  return /^\d{44}$/.test(chave);
}

function getSdkConfig(): SdkConfig {
  return {
    ambiente: (Number(process.env.SEFAZ_AMBIENTE) || 1) as 1 | 2,
    certificado:
      process.env.SEFAZ_CERT_PATH && process.env.SEFAZ_CERT_PASS
        ? { caminho: process.env.SEFAZ_CERT_PATH, senha: process.env.SEFAZ_CERT_PASS }
        : undefined,
    timeout: 45000,
  };
}

function montarCondicoesListagem(tipo: string, cnpj: string, movimento: Movimento) {
  const conditions = [eq(documentos.tipo, tipo as any)];

  if (movimento === 'recebidas') {
    conditions.push(eq(documentos.cnpjDestinatario, cnpj));
  } else if (movimento === 'todas') {
    conditions.push(or(eq(documentos.cnpjEmitente, cnpj), eq(documentos.cnpjDestinatario, cnpj)) as any);
  } else {
    conditions.push(eq(documentos.cnpjEmitente, cnpj));
  }

  return conditions;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const documentoSchema = {
  type: 'object',
  properties: {
    chaveAcesso: { type: 'string' },
    tipo: { type: 'string' },
    numero: { type: 'string' },
    serie: { type: 'string' },
    dataEmissao: { type: 'string', format: 'date-time' },
    cnpjEmitente: { type: 'string' },
    razaoSocialEmitente: { type: 'string' },
    cnpjDestinatario: { type: 'string' },
    valorTotal: { type: 'string' },
    status: { type: 'string' },
    protocolo: { type: 'string' },
    fonte: { type: 'string' },
  },
};

async function consultarComCache(chave: string, config: SdkConfig, tipo: TipoDocumento) {
  const cache = await buscarNoCache(chave);
  if (cache) {
    return { sucesso: true, documento: docParaFiscal(cache), fonte: 'cache' as const };
  }

  const resultado = await consultarNFeporChave({ chaveAcesso: chave, tipo }, config);
  if (resultado.sucesso && resultado.documento) {
    await salvarNoCache(resultado.documento);
  }
  return resultado;
}

export function createDocumentRoutes(options: DocumentRouteOptions) {
  return async function (app: FastifyInstance) {
    app.get(
      '/:chave',
      {
        schema: {
          tags: [options.label],
          summary: `Consulta ${options.label} por chave de acesso`,
          params: {
            type: 'object',
            required: ['chave'],
            properties: { chave: { type: 'string', minLength: 44, maxLength: 56 } },
          },
          response: {
            200: { type: 'object', properties: { sucesso: { type: 'boolean' }, dados: documentoSchema }, additionalProperties: true },
            400: { type: 'object', properties: { sucesso: { type: 'boolean' }, erro: { type: 'string' } } },
            404: { type: 'object', properties: { sucesso: { type: 'boolean' }, erro: { type: 'string' } } },
          },
        },
      },
      async (request, reply) => {
        const { chave } = request.params as { chave: string };
        if (!chaveValidaParaTipo(chave, options.tipo)) {
          return reply.status(400).send({ sucesso: false, erro: 'Chave de acesso invalida para este tipo' });
        }

        const tipoEsperado = tipoDaChave(chave);
        if (tipoEsperado && tipoEsperado !== options.tipo) {
          return reply.status(400).send({ sucesso: false, erro: `A chave informada corresponde a ${tipoEsperado.toUpperCase()}` });
        }
        if (!tipoEsperado && !TIPOS_SEM_CHAVE_44.has(options.tipo)) {
          return reply.status(400).send({ sucesso: false, erro: 'Nao foi possivel identificar o tipo pela chave' });
        }

        const config = getSdkConfig();
        const resultado = await consultarComCache(chave, config, options.tipo as TipoDocumento);
        const usuarioId = (request as any).conta?.id;

        if (!resultado.sucesso) {
          await registrarConsulta({ tipo: options.tipo, consulta: chave, resultado: 'erro', ip: request.ip, usuarioId });
          return reply.status(404).send({ sucesso: false, erro: resultado.erro || `${options.label} nao encontrado` });
        }

        if (resultado.fonte !== 'cache' && resultado.documento?.xml && usuarioId) {
          try {
            const conta = (request as any).conta as { cnpj?: string | null } | undefined;
            const direcao = conta?.cnpj && resultado.documento.cnpjDestinatario === conta.cnpj ? 'entradas' : 'emitidas';
            await enviarXmlContabilidadeAutomatico({
              usuarioId,
              chave: resultado.documento.chaveAcesso,
              xml: resultado.documento.xml,
            });
            await arquivarXmlEmR2({
              usuarioId,
              chave: resultado.documento.chaveAcesso,
              xml: resultado.documento.xml,
              dataEmissao: new Date(resultado.documento.dataEmissao),
              tipo: options.tipo,
              direcao,
            });
          } catch (error) {
            console.error('[contabilidade] erro no envio automatico:', error);
          }
        }

        await registrarConsulta({ tipo: options.tipo, consulta: chave, resultado: 'sucesso', ip: request.ip, usuarioId });

        return {
          sucesso: true,
          dados: { ...resultado.documento, tipo: options.tipo, fonte: resultado.fonte },
        };
      },
    );

    app.get('/:chave/xml', async (request, reply) => {
      const { chave } = request.params as { chave: string };
      const formato = String((request.query as { format?: string })?.format || '').toLowerCase();
      if (!chaveValidaParaTipo(chave, options.tipo)) {
        return reply.status(400).send({ sucesso: false, erro: 'Chave de acesso invalida para este tipo' });
      }

      const tipoEsperado = tipoDaChave(chave);
      if (tipoEsperado && tipoEsperado !== options.tipo) {
        return reply.status(400).send({ sucesso: false, erro: `A chave informada corresponde a ${tipoEsperado.toUpperCase()}` });
      }
      if (!tipoEsperado && !TIPOS_SEM_CHAVE_44.has(options.tipo)) {
        return reply.status(400).send({ sucesso: false, erro: 'Nao foi possivel identificar o tipo pela chave' });
      }

      const cache = await buscarNoCache(chave);
      const usuarioId = (request as any).conta?.id;
      if ((formato === 'danfe' || formato === 'pdf') && cache?.xml) {
        await registrarConsulta({ tipo: `${options.tipo}:xml`, consulta: chave, resultado: 'sucesso', ip: request.ip, usuarioId });
        const pdf = await gerarPdfDanfe(docParaFiscal(cache));
        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `inline; filename="danfe-${chave}.pdf"`)
          .send(pdf);
      }

      if (cache?.xml) {
        await registrarConsulta({ tipo: `${options.tipo}:xml`, consulta: chave, resultado: 'sucesso', ip: request.ip, usuarioId });
        return reply.type('application/xml').send(cache.xml);
      }

      const config = getSdkConfig();
      const resultado = await consultarNFeporChave({ chaveAcesso: chave, tipo: options.tipo as TipoDocumento }, config);

    if (!resultado.sucesso || !resultado.documento?.xml) {
      await registrarConsulta({ tipo: `${options.tipo}:xml`, consulta: chave, resultado: 'erro', ip: request.ip, usuarioId });
      return reply.status(404).send({ sucesso: false, erro: 'XML nao disponivel' });
    }

    await salvarNoCache(resultado.documento);
    if (usuarioId) {
      try {
        await enviarXmlContabilidadeAutomatico({
          usuarioId,
          chave: resultado.documento.chaveAcesso,
          xml: resultado.documento.xml,
        });
      } catch (error) {
        console.error('[contabilidade] erro no envio automatico:', error);
      }
    }
    await registrarConsulta({ tipo: `${options.tipo}:xml`, consulta: chave, resultado: 'sucesso', ip: request.ip, usuarioId });
      if (formato === 'danfe' || formato === 'pdf') {
        const pdf = await gerarPdfDanfe(resultado.documento);
        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `inline; filename="danfe-${chave}.pdf"`)
          .send(pdf);
      }

      return reply.type('application/xml').send(resultado.documento.xml);
    });

    app.get('/', async (request, reply) => {
      const { cnpj, movimento, pagina = 1, limite = 20, inicio, fim } = request.query as any;
      const paginaNum = Math.max(1, Number(pagina) || 1);
      const limiteNum = Math.min(100, Math.max(1, Number(limite) || 20));
      const filtroMovimento = normalizarMovimento(movimento);
      const inicioDate = parseDate(String(inicio || ''));
      const fimDate = parseDate(String(fim || ''));

      if (!cnpj || !/^\d{14}$/.test(cnpj)) {
        return reply.status(400).send({ sucesso: false, erro: 'CNPJ deve ter 14 digitos numericos' });
      }

      const offset = (paginaNum - 1) * limiteNum;
      const conditions = montarCondicoesListagem(options.tipo, cnpj, filtroMovimento);
      if (inicioDate) conditions.push(gte(documentos.dataEmissao, inicioDate));
      if (fimDate) conditions.push(lte(documentos.dataEmissao, fimDate));

      const resultados = await db
        .select()
        .from(documentos)
        .where(and(...conditions))
        .orderBy(desc(documentos.dataEmissao))
        .limit(limiteNum)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(documentos)
        .where(and(...conditions));

      return {
        sucesso: true,
        dados: { documentos: resultados, total: Number(count), pagina: paginaNum, limite: limiteNum },
      };
    });
  };
}
