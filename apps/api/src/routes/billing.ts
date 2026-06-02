import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { atualizarAssinaturaUsuario, atualizarPlanoUsuario, encontrarUsuarioPorApiKey, obterAssinaturaUsuario } from '../db/auth.js';
import {
  criarCheckoutInfinitePay,
  type InfinitePayWebhookPayload,
  validarWebhookPlano,
  webhookEstaPago,
} from '../utils/infinitepay.js';

const checkoutSchema = z.object({
  plano: z.enum(['starter', 'pro', 'enterprise']),
});

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
        plano: body.plano,
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

    const validado = validarWebhookPlano(body);
    if (!validado) {
      return reply.status(400).send({ sucesso: false, erro: 'Webhook invalido.' });
    }

    await atualizarPlanoUsuario(validado.usuarioId, validado.plano);
    const agora = new Date();
    await atualizarAssinaturaUsuario(validado.usuarioId, {
      status: 'ativa',
      cancelEm: null,
      renovaEm: adicionarDias(agora, 30),
    });
    return { sucesso: true };
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
      plano: planoAtual,
    });

    return { sucesso: true, dados: checkout };
  });
}
