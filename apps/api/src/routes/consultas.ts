import type { FastifyInstance } from 'fastify';
import { consultarNFeporChave } from '@dfecentral/sdk';
import type { ConsultaResultado, TipoDocumento } from '@dfecentral/sdk';
import { listarConsultasRecentes } from '../db/audit.js';
import { salvarNoCache } from '../db/cache.js';
import { registrarConsulta } from '../db/audit.js';
import { obterSdkConfigComCertificado } from '../utils/certificados.js';

type ConsultaLoteItem = {
  chaveAcesso: string;
  tipo?: TipoDocumento;
};

export async function consultasRoutes(app: FastifyInstance) {
  app.post('/lote', async (request, reply) => {
    const body = request.body as { itens?: ConsultaLoteItem[] } | undefined;
    const itens = Array.isArray(body?.itens) ? body!.itens : [];
    const usuarioId = (request as any).conta?.id;

    if (itens.length === 0) {
      return reply.status(400).send({ sucesso: false, erro: 'Nenhuma chave informada' });
    }

    if (itens.length > 50) {
      return reply.status(400).send({ sucesso: false, erro: 'Limite maximo de 50 chaves por lote' });
    }

    const { config, cleanup } = await obterSdkConfigComCertificado({ usuarioId });
    try {
      const resultados: Array<{
        chaveAcesso: string;
        tipo?: TipoDocumento;
        sucesso: boolean;
        fonte: string;
        erro?: string;
        documento?: ConsultaResultado['documento'];
      }> = [];

      for (const item of itens) {
        const chaveAcesso = String(item?.chaveAcesso || '').replace(/\s/g, '');
        const tipo = item?.tipo;

        if (!chaveAcesso) {
          resultados.push({ chaveAcesso: '', tipo, sucesso: false, fonte: 'mock', erro: 'Chave ausente' });
          continue;
        }

        const resultado = await consultarNFeporChave({ chaveAcesso, tipo }, config);
        if (resultado.sucesso && resultado.documento) {
          await salvarNoCache(resultado.documento);
          resultados.push({
            chaveAcesso: resultado.documento.chaveAcesso,
            tipo: resultado.documento.tipo,
            sucesso: true,
            fonte: resultado.fonte,
            documento: { ...resultado.documento, xml: undefined },
          });
          await registrarConsulta({
            tipo: `consulta:lote:${resultado.documento.tipo}`,
            consulta: resultado.documento.chaveAcesso,
            resultado: 'sucesso',
            ip: request.ip,
            usuarioId,
          });
        } else {
          resultados.push({
            chaveAcesso,
            tipo,
            sucesso: false,
            fonte: resultado.fonte,
            erro: resultado.erro || 'Consulta nao disponivel',
          });
          await registrarConsulta({
            tipo: `consulta:lote:${tipo || 'auto'}`,
            consulta: chaveAcesso,
            resultado: 'erro',
            ip: request.ip,
            usuarioId,
          });
        }
      }

      return { sucesso: true, total: resultados.length, resultados };
    } finally {
      cleanup?.();
    }
  });

  app.get('/recentes', async (request, reply) => {
    const { cnpj, limite = 12 } = request.query as { cnpj?: string; limite?: string | number };
    const cnpjLimpo = String(cnpj || '').replace(/\D/g, '').slice(0, 14);
    const limiteNum = Math.min(50, Math.max(1, Number(limite) || 12));

    if (cnpj && !/^\d{14}$/.test(cnpjLimpo)) {
      return reply.status(400).send({ sucesso: false, erro: 'CNPJ invalido' });
    }

    const registros = await listarConsultasRecentes(cnpjLimpo || undefined, limiteNum);

    return {
      sucesso: true,
      dados: {
        consultas: registros.map((item) => ({
          id: item.id,
          tipo: item.tipo,
          consulta: item.consulta,
          resultado: item.resultado,
          ip: item.ip,
          criadoEm: item.criadoEm,
        })),
      },
    };
  });
}
