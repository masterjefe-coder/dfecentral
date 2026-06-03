import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { atualizarAssinaturaUsuario, atualizarPlanoUsuario, encontrarUsuarioPorApiKey, mesclarPreferenciasUsuario, obterAssinaturaUsuario, obterEmpresaAtiva, obterPreferenciasUsuario } from '../db/auth.js';
import { obterCobrancaAssinaturaPendente } from '../db/assinaturas.js';
import { confirmarPagamentoAssinatura, criarCheckoutAssinatura } from '../services/assinaturas.js';
import {
  criarCheckoutRecebeAqui,
  extrairReferenciaRecebeAqui,
  extrairReferenciaRecebeAquiArquivamento,
  obterPrecoArquivamentoRecebeAqui,
  obterPrecoPlanoRecebeAqui,
  pagamentoWebhookEstaPago,
  resolverReferenciaRecebeAquiWebhook,
  type MetodoPagamentoAssinatura,
  type RecebeAquiWebhookPayload,
} from '../utils/recebeaqui.js';

const checkoutSchema = z.discriminatedUnion('produto', [
  z.object({
    produto: z.literal('plano'),
    plano: z.enum(['starter', 'pro', 'enterprise']),
    metodoPagamento: z.enum(['cartao', 'pix_boleto']).optional(),
  }),
  z.object({ produto: z.literal('arquivamento'), arquivamento: z.enum(['starter', 'pro']) }),
]);

const renewCheckoutSchema = z.object({
  metodoPagamento: z.enum(['cartao', 'pix_boleto']).optional(),
});

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

function normalizarMetodoPagamento(valor?: string | null): MetodoPagamentoAssinatura {
  return valor === 'pix_boleto' ? 'pix_boleto' : 'cartao';
}

export async function billingRoutes(app: FastifyInstance) {
  app.get('/subscription', async (request, reply) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || request.headers['x-api-key']?.toString()?.trim();
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida.' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida.' });
    const cnpjAtivo = await obterEmpresaAtiva(usuario.id);

    const assinatura = await obterAssinaturaUsuario(usuario.id);
    if (!assinatura) return reply.status(404).send({ sucesso: false, erro: 'Assinatura nao encontrada.' });

    const cobrancaPendente = await obterCobrancaAssinaturaPendente(usuario.id);
    return { sucesso: true, dados: { assinatura, cobrancaPendente } };
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
    const cnpjAtivo = await obterEmpresaAtiva(usuario.id);

    const body = checkoutSchema.parse(request.body);

    try {
      if (body.produto === 'plano') {
        const metodoPagamento = normalizarMetodoPagamento(body.metodoPagamento);
        if (!cnpjAtivo && !usuario.cnpj && !usuario.cnpjAtivo) {
          return reply.status(400).send({ sucesso: false, erro: 'Cadastre um CNPJ ativo para assinar qualquer plano.' });
        }

        const checkout = await criarCheckoutAssinatura({
          usuario: {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            plano: usuario.plano,
            assinaturaMetodoPagamento: usuario.assinaturaMetodoPagamento,
            assinaturaRenovaEm: usuario.assinaturaRenovaEm,
            cnpj: usuario.cnpj,
            cnpjAtivo: usuario.cnpjAtivo,
            cnpjAtivoEmpresa: cnpjAtivo,
          },
          plano: body.plano,
          metodoPagamento,
          origem: 'assinatura',
          venceEm: new Date(),
        });

        return {
          sucesso: true,
          dados: {
            checkoutUrl: checkout.checkoutUrl,
            externalReference: checkout.externalReference,
          },
        };
      }

      const checkout = await criarCheckoutRecebeAqui({
        usuarioId: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        produto: body.produto,
        arquivamento: body.arquivamento,
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
      const pagamentoAssinatura = extrairReferenciaRecebeAqui(referenciaWebhook);
      if (pagamentoAssinatura) {
        const confirmado = await confirmarPagamentoAssinatura(referenciaWebhook);
        if (!confirmado) {
          return reply.status(400).send({ sucesso: false, erro: 'Cobrança da assinatura nao encontrada.' });
        }

        const esperado = obterPrecoPlanoRecebeAqui(pagamentoAssinatura.plano);
        const recebido = body.Payment?.AmountPaid ?? body.payment?.AmountPaid ?? body.Payment?.amountPaid ?? body.payment?.amountPaid;
        if (typeof recebido === 'number' && Math.round(recebido * 100) !== esperado) {
          request.log.warn({ recebido, esperado }, 'Webhook de plano com valor divergente');
        }

        await atualizarPlanoUsuario(pagamentoAssinatura.usuarioId, pagamentoAssinatura.plano);
        await atualizarAssinaturaUsuario(pagamentoAssinatura.usuarioId, {
          status: 'ativa',
          cancelEm: null,
          metodoPagamento: pagamentoAssinatura.metodoPagamento,
        });

        await notificarWebhookCliente(pagamentoAssinatura.usuarioId, {
          evento: 'pagamento_confirmado',
          provedor: 'recebeaqui',
          tipo: 'plano',
          plano: pagamentoAssinatura.plano,
          metodoPagamento: confirmado.metodoPagamento,
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
    const cnpjAtivo = await obterEmpresaAtiva(usuario.id);

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
    const cnpjAtivo = await obterEmpresaAtiva(usuario.id);

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
    const cnpjAtivo = await obterEmpresaAtiva(usuario.id);

    const assinatura = await obterAssinaturaUsuario(usuario.id);
    if (!assinatura) return reply.status(404).send({ sucesso: false, erro: 'Assinatura nao encontrada.' });

    const body = renewCheckoutSchema.parse(request.body ?? {});
    const metodoPagamento = body.metodoPagamento || normalizarMetodoPagamento(assinatura.assinaturaMetodoPagamento);
    if (!cnpjAtivo && !usuario.cnpj && !usuario.cnpjAtivo) {
      return reply.status(400).send({ sucesso: false, erro: 'Cadastre um CNPJ ativo para assinar qualquer plano.' });
    }
    const planoAtual = assinatura.plano === 'free' ? 'starter' : (assinatura.plano as 'starter' | 'pro' | 'enterprise');
    const checkout = await criarCheckoutAssinatura({
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        plano: usuario.plano,
        assinaturaMetodoPagamento: assinatura.assinaturaMetodoPagamento,
        assinaturaRenovaEm: assinatura.assinaturaRenovaEm,
        cnpj: usuario.cnpj,
        cnpjAtivo: usuario.cnpjAtivo,
        cnpjAtivoEmpresa: cnpjAtivo,
      },
      plano: planoAtual,
      metodoPagamento,
      origem: metodoPagamento === assinatura.assinaturaMetodoPagamento ? 'renovacao' : 'troca_metodo',
      venceEm: assinatura.assinaturaRenovaEm || new Date(),
    });

    return { sucesso: true, dados: checkout };
  });
}
