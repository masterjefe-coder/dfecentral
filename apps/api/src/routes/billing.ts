import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { atualizarAssinaturaUsuario, atualizarPlanoUsuario, encontrarUsuarioPorApiKey, mesclarPreferenciasUsuario, obterAssinaturaUsuario } from '../db/auth.js';
import {
  criarCheckoutInfinitePay,
  type InfinitePayWebhookPayload,
  validarWebhookArquivamento,
  validarWebhookPlano,
  webhookEstaPago,
} from '../utils/infinitepay.js';

const checkoutSchema = z.discriminatedUnion('produto', [
  z.object({ produto: z.literal('plano'), plano: z.enum(['starter', 'pro', 'enterprise']) }),
  z.object({ produto: z.literal('arquivamento'), arquivamento: z.enum(['starter', 'pro']) }),
]);

function adicionarDias(base: Date, dias: number): Date {
  return new Date(base.getTime() + dias * 24 * 60 * 60 * 1000);
}

export async function billingRoutes(app: FastifyInstance) {
  app.get('/subscription', async (request, reply) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || request.headers['x-api-key']?.toString()?.trim();
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida.' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida.' });

    const assinatura = await obterAssinaturaUsuario(usuario.id);
    if (!assinatura) return reply.status(404).send({ sucesso: false, erro: 'Assinatura nao encontrada.' });

    return { sucesso: true, dados: { assinatura } };
  });

  app.post('/infinitepay/checkout', async (request, reply) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || request.headers['x-api-key']?.toString()?.trim();
    if (!token) {
      return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida.' });
    }

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) {
      return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida.' });
    }

    const body = checkoutSchema.parse(request.body);

    try {
      const checkout = await criarCheckoutInfinitePay({
        usuarioId: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        produto: body.produto,
        ...(body.produto === 'plano' ? { plano: body.plano } : { arquivamento: body.arquivamento }),
      });

      return {
        sucesso: true,
        dados: {
          checkoutUrl: checkout.checkoutUrl,
          payload: checkout.payload,
        },
      };
    } catch (erro) {
      request.log.error({ erro }, 'Erro ao criar checkout InfinitePay');
      return reply.status(502).send({ sucesso: false, erro: 'Nao foi possivel criar o checkout.' });
    }
  });

  app.post('/infinitepay/webhook', async (request, reply) => {
    const body = request.body as InfinitePayWebhookPayload;
    if (!webhookEstaPago(body)) {
      return reply.status(200).send({ sucesso: true, ignorado: true });
    }

    const plano = validarWebhookPlano(body);
    if (plano) {
      await atualizarPlanoUsuario(plano.usuarioId, plano.plano);
      const agora = new Date();
      await atualizarAssinaturaUsuario(plano.usuarioId, {
        status: 'ativa',
        cancelEm: null,
        renovaEm: adicionarDias(agora, 30),
      });
      return { sucesso: true };
    }

    const arquivamento = validarWebhookArquivamento(body);
    if (arquivamento) {
      await mesclarPreferenciasUsuario(arquivamento.usuarioId, {
        arquivamentoXmlAtivo: true,
        arquivamentoXmlPlano: arquivamento.arquivamento,
      });
      return { sucesso: true };
    }

    return reply.status(400).send({ sucesso: false, erro: 'Webhook invalido.' });
  });

  app.post('/subscription/cancel', async (request, reply) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || request.headers['x-api-key']?.toString()?.trim();
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida.' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida.' });

    const assinatura = await obterAssinaturaUsuario(usuario.id);
    if (!assinatura) return reply.status(404).send({ sucesso: false, erro: 'Assinatura nao encontrada.' });

    const cancelEm = assinatura.assinaturaRenovaEm ? new Date(assinatura.assinaturaRenovaEm) : adicionarDias(new Date(), 30);
    await atualizarAssinaturaUsuario(usuario.id, { status: 'cancelada', cancelEm, renovaEm: assinatura.assinaturaRenovaEm ? new Date(assinatura.assinaturaRenovaEm) : cancelEm });
    return { sucesso: true, dados: { cancelEm: cancelEm.toISOString() } };
  });

  app.post('/subscription/restore', async (request, reply) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || request.headers['x-api-key']?.toString()?.trim();
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida.' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida.' });

    const assinatura = await obterAssinaturaUsuario(usuario.id);
    if (!assinatura) return reply.status(404).send({ sucesso: false, erro: 'Assinatura nao encontrada.' });

    await atualizarAssinaturaUsuario(usuario.id, { status: 'ativa', cancelEm: null, renovaEm: assinatura.assinaturaRenovaEm || adicionarDias(new Date(), 30) });
    return { sucesso: true };
  });

  app.post('/subscription/renew-checkout', async (request, reply) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || request.headers['x-api-key']?.toString()?.trim();
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida.' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida.' });

    const assinatura = await obterAssinaturaUsuario(usuario.id);
    if (!assinatura) return reply.status(404).send({ sucesso: false, erro: 'Assinatura nao encontrada.' });

    const planoAtual = assinatura.plano === 'free' ? 'starter' : (assinatura.plano as 'starter' | 'pro' | 'enterprise');
    const checkout = await criarCheckoutInfinitePay({
      usuarioId: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      produto: 'plano',
      plano: planoAtual,
    });

    return { sucesso: true, dados: checkout };
  });
}
