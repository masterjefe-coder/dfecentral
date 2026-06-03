import { and, eq, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { usuarios } from '../db/schema.js';
import { obterEmpresaAtiva } from '../db/auth.js';
import {
  ajustarProximaCobrancaUsuario,
  atualizarAssinaturaMetodoPagamento,
  obterCobrancaAssinaturaPendente,
  obterCobrancaAssinaturaPorReferencia,
  marcarCobracaoAssinaturaComoPaga,
  salvarCobrancaAssinatura,
} from '../db/assinaturas.js';
import { criarCheckoutRecebeAqui, type MetodoPagamentoAssinatura, type PlanoRecebeAqui } from '../utils/recebeaqui.js';
import { enviarEmail, temSMTPConfigurado } from '../utils/mailer.js';

function adicionarDias(base: Date, dias: number): Date {
  return new Date(base.getTime() + dias * 24 * 60 * 60 * 1000);
}

type UsuarioAssinatura = {
  id: string;
  nome: string;
  email: string;
  plano: string;
  assinaturaMetodoPagamento: string;
  assinaturaRenovaEm: Date | null;
  cnpj?: string | null;
  cnpjAtivo?: string | null;
  cnpjAtivoEmpresa?: string | null;
};

export async function criarCheckoutAssinatura(input: {
  usuario: UsuarioAssinatura;
  plano: PlanoRecebeAqui;
  metodoPagamento: MetodoPagamentoAssinatura;
  origem: 'assinatura' | 'renovacao' | 'troca_metodo';
  venceEm?: Date;
}): Promise<{ checkoutUrl: string; externalReference: string }> {
  const empresaAtiva = await obterEmpresaAtiva(input.usuario.id);
  const checkout = await criarCheckoutRecebeAqui({
    usuarioId: input.usuario.id,
    nome: input.usuario.nome,
    email: input.usuario.email,
    produto: 'plano',
    plano: input.plano,
    metodoPagamento: input.metodoPagamento,
    taxId: empresaAtiva || input.usuario.cnpjAtivo || input.usuario.cnpj || undefined,
  });

  const externalReference = checkout.externalReference;
  const checkoutUrl = checkout.checkoutUrl;
  const venceEm = input.venceEm || input.usuario.assinaturaRenovaEm || new Date();

  if (!externalReference) {
    throw new Error('RecebeAqui nao retornou externalReference');
  }

  await salvarCobrancaAssinatura({
    usuarioId: input.usuario.id,
    plano: input.plano,
    metodoPagamento: input.metodoPagamento,
    origem: input.origem,
    externalReference,
    checkoutUrl,
    venceEm,
  });

  return { checkoutUrl, externalReference };
}

export async function processarCobrancasAssinaturaVencidas(log?: { info?: (data: unknown, message?: string) => void; warn?: (data: unknown, message?: string) => void }) {
  const agora = new Date();
  const usuariosVencidos = await db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      plano: usuarios.plano,
      assinaturaMetodoPagamento: usuarios.assinaturaMetodoPagamento,
      assinaturaRenovaEm: usuarios.assinaturaRenovaEm,
      cnpj: usuarios.cnpj,
      cnpjAtivo: usuarios.cnpjAtivo,
    })
    .from(usuarios)
    .where(and(eq(usuarios.assinaturaStatus, 'ativa'), eq(usuarios.assinaturaMetodoPagamento, 'pix'), lte(usuarios.assinaturaRenovaEm, agora)));

  for (const usuario of usuariosVencidos) {
    const pendente = await obterCobrancaAssinaturaPendente(usuario.id);
    if (pendente && pendente.status === 'pendente' && pendente.venceEm && new Date(pendente.venceEm).getTime() >= new Date(usuario.assinaturaRenovaEm || agora).getTime()) {
      continue;
    }

    const proxima = usuario.assinaturaRenovaEm ? new Date(usuario.assinaturaRenovaEm) : agora;
    const checkout = await criarCheckoutAssinatura({
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        plano: usuario.plano,
        assinaturaMetodoPagamento: usuario.assinaturaMetodoPagamento,
        assinaturaRenovaEm: usuario.assinaturaRenovaEm,
      },
      plano: usuario.plano as PlanoRecebeAqui,
      metodoPagamento: 'pix',
      origem: 'renovacao',
      venceEm: proxima,
    });

    if (temSMTPConfigurado()) {
      try {
        await enviarEmail({
          to: usuario.email,
          subject: 'DFeCentral - nova cobrança da assinatura',
          text: `Sua cobrança mensal está pronta. Acesse: ${checkout.checkoutUrl}`,
          html: `<p>Sua cobrança mensal está pronta.</p><p><a href="${checkout.checkoutUrl}">${checkout.checkoutUrl}</a></p>`,
        });
      } catch (erro) {
        log?.warn?.({ erro, usuarioId: usuario.id }, 'Falha ao enviar cobrança mensal por e-mail');
      }
    }

    log?.info?.({ usuarioId: usuario.id, checkoutUrl: checkout.checkoutUrl }, 'Cobrança mensal gerada');
  }
}

export async function confirmarPagamentoAssinatura(externalReference: string) {
  const cobranca = await obterCobrancaAssinaturaPorReferencia(externalReference);
  if (!cobranca) return null;

  await marcarCobracaoAssinaturaComoPaga(externalReference);
  await atualizarAssinaturaMetodoPagamento(cobranca.usuarioId, cobranca.metodoPagamento as MetodoPagamentoAssinatura);
  await ajustarProximaCobrancaUsuario(cobranca.usuarioId, adicionarDias(new Date(cobranca.venceEm), 30));
  return cobranca;
}
