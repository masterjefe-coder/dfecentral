import type { FastifyInstance } from 'fastify';
import { and, eq, gte, lt, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { documentos } from '../db/schema.js';
import { encontrarUsuarioPorApiKey, obterEmpresaAtiva } from '../db/auth.js';
import { criarPacoteXmlMensal, enviarPacoteXmlMensal, enviarXmlContabilidadeAutomatico, obterEmailContabilidade } from '../utils/contabilidade.js';
import { enviarEmailComAnexo } from '../utils/mailer.js';

function extrairToken(authorization?: string, apiKey?: string): string | null {
  const headerValue = authorization || apiKey || '';
  if (!headerValue) return null;
  const bearerMatch = headerValue.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) return bearerMatch[1].trim();
  return headerValue.trim();
}

const schema = z.object({
  chave: z.string().min(44),
  email: z.string().email().optional(),
});

const pacoteSchema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  incluirEntradas: z.boolean().optional(),
  email: z.string().email().optional(),
});

function normalizarMes(valor?: string): string {
  if (valor && /^\d{4}-\d{2}$/.test(valor)) return valor;
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}

function inicioMes(mes: string): Date {
  const [ano, numeroMes] = mes.split('-').map(Number);
  return new Date(Date.UTC(ano, numeroMes - 1, 1, 0, 0, 0, 0));
}

function inicioProximoMes(mes: string): Date {
  const [ano, numeroMes] = mes.split('-').map(Number);
  return new Date(Date.UTC(ano, numeroMes, 1, 0, 0, 0, 0));
}

async function carregarDocumentosMes(usuarioId: string, mes: string, incluirEntradas: boolean) {
  const cnpjAtivo = await obterEmpresaAtiva(usuarioId);
  if (!cnpjAtivo) return [];

  const condicoes: any[] = [gte(documentos.dataEmissao, inicioMes(mes)), lt(documentos.dataEmissao, inicioProximoMes(mes))];
  condicoes.push(
    incluirEntradas
      ? or(eq(documentos.cnpjEmitente, cnpjAtivo), eq(documentos.cnpjDestinatario, cnpjAtivo))
      : eq(documentos.cnpjEmitente, cnpjAtivo),
  );

  const selecionados = await db.select().from(documentos).where(and(...condicoes));
  const vistos = new Set<string>();

  return selecionados
    .filter((doc) => doc.xmlCompleto)
    .filter((doc) => {
      if (vistos.has(doc.chaveAcesso)) return false;
      vistos.add(doc.chaveAcesso);
      return true;
    })
    .map((doc) => ({
      chaveAcesso: doc.chaveAcesso,
      tipo: doc.tipo,
      dataEmissao: new Date(doc.dataEmissao),
      xml: typeof doc.xmlCompleto === 'string' ? doc.xmlCompleto : JSON.stringify(doc.xmlCompleto, null, 2),
      direcao: doc.cnpjEmitente === cnpjAtivo ? ('emitidas' as const) : ('entradas' as const),
    }));
}

export async function contabilidadeRoutes(app: FastifyInstance) {
  app.post('/xml', async (request, reply) => {
    const token = extrairToken(request.headers.authorization, request.headers['x-api-key']?.toString());
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida' });

    const body = schema.parse(request.body);
    const destino = body.email || obterEmailContabilidade(usuario.preferencias) || null;
    if (!destino) {
      return reply.status(400).send({ sucesso: false, erro: 'Informe o e-mail da contabilidade nas preferencias ou no envio.' });
    }

    const docs = await db.select().from(documentos).where(eq(documentos.chaveAcesso, body.chave)).limit(1);
    const doc = docs[0];
    if (!doc || !doc.xmlCompleto) {
      return reply.status(404).send({ sucesso: false, erro: 'XML nao encontrado no banco.' });
    }

    const xml = typeof doc.xmlCompleto === 'string' ? doc.xmlCompleto : JSON.stringify(doc.xmlCompleto, null, 2);
    await enviarEmailComAnexo({
      to: destino,
      subject: `XML fiscal ${doc.chaveAcesso}`,
      text: `Segue em anexo o XML fiscal da chave ${doc.chaveAcesso}.`,
      html: `<p>Segue em anexo o XML fiscal da chave <strong>${doc.chaveAcesso}</strong>.</p>`,
      attachments: [
        {
          filename: `xml-${doc.chaveAcesso}.xml`,
          content: xml,
          contentType: 'application/xml',
        },
      ],
    });

    return { sucesso: true, dados: { enviado: true, email: destino } };
  });

  app.post('/pacote-mensal', async (request, reply) => {
    const token = extrairToken(request.headers.authorization, request.headers['x-api-key']?.toString());
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida' });

    const body = pacoteSchema.parse(request.body);
    const mes = normalizarMes(body.mes);
    const incluirEntradas = Boolean(body.incluirEntradas);
    const destino = body.email || obterEmailContabilidade(usuario.preferencias) || null;
    if (!destino) {
      return reply.status(400).send({ sucesso: false, erro: 'Informe o e-mail da contabilidade nas preferencias ou no envio.' });
    }

    const documentosMes = await carregarDocumentosMes(usuario.id, mes, incluirEntradas);
    if (documentosMes.length === 0) {
      return reply.status(404).send({ sucesso: false, erro: 'Nao ha XMLs disponiveis para o mes informado.' });
    }

    const pacote = await enviarPacoteXmlMensal({
      usuarioId: usuario.id,
      to: destino,
      mes,
      incluirEntradas,
      documentos: documentosMes,
    });

    return {
      sucesso: true,
      dados: {
        enviado: true,
        email: destino,
        mes,
        incluirEntradas,
        arquivo: pacote.nomeArquivo,
        total: pacote.total,
      },
    };
  });

  app.post('/pacote-mensal/arquivo', async (request, reply) => {
    const token = extrairToken(request.headers.authorization, request.headers['x-api-key']?.toString());
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida' });

    const body = pacoteSchema.parse(request.body);
    const mes = normalizarMes(body.mes);
    const incluirEntradas = Boolean(body.incluirEntradas);
    const documentosMes = await carregarDocumentosMes(usuario.id, mes, incluirEntradas);
    if (documentosMes.length === 0) {
      return reply.status(404).send({ sucesso: false, erro: 'Nao ha XMLs disponiveis para o mes informado.' });
    }

    const pacote = await criarPacoteXmlMensal({ mes, incluirEntradas, documentos: documentosMes });
    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="${pacote.nomeArquivo}"`)
      .send(pacote.buffer);
  });
}
