import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { atualizarAssinaturaUsuario, atualizarPlanoUsuario, encontrarUsuarioPorApiKey, mesclarPreferenciasUsuario, obterAssinaturaUsuario, obterPreferenciasUsuario } from '../db/auth.js';
import {
  criarCheckoutRecebeAqui,
  extrairReferenciaRecebeAqui,
  extrairReferenciaRecebeAquiArquivamento,
  obterPrecoArquivamentoRecebeAqui,
  obterPrecoPlanoRecebeAqui,
  pagamentoWebhookEstaPago,
  resolverReferenciaRecebeAquiWebhook,
  type RecebeAquiWebhookPayload,
} from '../utils/recebeaqui.js';

const checkoutSchema = z.discriminatedUnion('produto', [
  z.object({ produto: z.literal('plano'), plano: z.enum(['starter', 'pro', 'enterprise']) }),
  z.object({ produto: z.literal('arquivamento'), arquivamento: z.enum(['starter', 'pro']) }),
]);

function adicionarDias(base: Date, dias: number): Date {
  return new Date(base.getTime() + dias * 24 * 60 * 60 * 1000);
}

async function notificarWebhookCliente(usuarioId: string, payload: Record<string, unknown>) {
  const preferencias = await obterPreferenciasUsuario(usuarioId);
  const webhookUrl = typeof preferencias.recebeaquiWebhookUrl === 'string' ? preferencias.recebeaquiWebhookUrl.trim() : '';
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Nao bloqueia a ativacao do plano ou do add-on.
  }
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

  app.post('/recebeaqui/checkout', async (request, reply) => {
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
      const checkout = await criarCheckoutRecebeAqui({
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
      request.log.error({ erro }, 'Erro ao criar checkout RecebeAqui');
      return reply.status(502).send({ sucesso: false, erro: 'Nao foi possivel criar o checkout.' });
    }
  });

  app.post('/recebeaqui/webhook', async (request, reply) => {
    const body = request.body as RecebeAquiWebhookPayload;
    if (!pagamentoWebhookEstaPago(body)) {
      return reply.status(200).send({ sucesso: true, ignorado: true });
    }

    const referenciaWebhook = await resolverReferenciaRecebeAquiWebhook(body);
    if (referenciaWebhook) {
      const plano = extrairReferenciaRecebeAqui(referenciaWebhook);
      if (plano) {
        const esperado = obterPrecoPlanoRecebeAqui(plano.plano);
        const recebido = body.Payment?.AmountPaid ?? body.payment?.AmountPaid ?? body.Payment?.amountPaid ?? body.payment?.amountPaid;
        if (typeof recebido === 'number' && Math.round(recebido * 100) !== esperado) {
          request.log.warn({ recebido, esperado }, 'Webhook de plano com valor divergente');
        }
        await atualizarPlanoUsuario(plano.usuarioId, plano.plano);
        const agora = new Date();
        await atualizarAssinaturaUsuario(plano.usuarioId, {
          status: 'ativa',
          cancelEm: null,
          renovaEm: new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000),
        });
        await notificarWebhookCliente(plano.usuarioId, {
          evento: 'pagamento_confirmado',
          provedor: 'recebeaqui',
          tipo: 'plano',
          plano: plano.plano,
          valor: recebido ?? esperado / 100,
          confirmadoEm: new Date().toISOString(),
        });
        return { sucesso: true };
      }

      const arquivamento = extrairReferenciaRecebeAquiArquivamento(referenciaWebhook);
      if (arquivamento) {
        const esperado = obterPrecoArquivamentoRecebeAqui(arquivamento.arquivamento);
        const recebido = body.Payment?.AmountPaid ?? body.payment?.AmountPaid ?? body.Payment?.amountPaid ?? body.payment?.amountPaid;
        if (typeof recebido === 'number' && Math.round(recebido * 100) !== esperado) {
          request.log.warn({ recebido, esperado }, 'Webhook de arquivamento com valor divergente');
        }
        await mesclarPreferenciasUsuario(arquivamento.usuarioId, {
          arquivamentoXmlAtivo: true,
          arquivamentoXmlPlano: arquivamento.arquivamento,
        });
        await notificarWebhookCliente(arquivamento.usuarioId, {
          evento: 'pagamento_confirmado',
          provedor: 'recebeaqui',
          tipo: 'arquivamento',
          arquivamento: arquivamento.arquivamento,
          valor: recebido ?? esperado / 100,
          confirmadoEm: new Date().toISOString(),
        });
        return { sucesso: true };
      }
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
    const checkout = await criarCheckoutRecebeAqui({
      usuarioId: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      produto: 'plano',
      plano: planoAtual,
    });

    return { sucesso: true, dados: checkout };
  });
}
