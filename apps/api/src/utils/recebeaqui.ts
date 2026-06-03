import { createHash } from 'node:crypto';

const CHECKOUT_URL = 'https://api.recebeaqui.com/v2/api/checkout';
const DEFAULT_API_BASE_URL = 'https://api.recebeaqui.com/v2';

const PLANOS = {
  starter: { amount: 4990, description: 'Plano Starter DFeCentral' },
  pro: { amount: 11990, description: 'Plano Pro DFeCentral' },
  enterprise: { amount: 19990, description: 'Plano Enterprise DFeCentral' },
} as const;

const ARQUIVAMENTO = {
  starter: { amount: 1990, description: 'Add-on XML Lite DFeCentral' },
  pro: { amount: 3990, description: 'Add-on XML Plus DFeCentral' },
} as const;

export type PlanoRecebeAqui = keyof typeof PLANOS;
export type ArquivamentoRecebeAqui = keyof typeof ARQUIVAMENTO;
export type ProdutoRecebeAqui = 'plano' | 'arquivamento';

export type RecebeAquiCheckoutInput = {
  usuarioId: string;
  nome: string;
  email: string;
  produto: ProdutoRecebeAqui;
  plano?: PlanoRecebeAqui;
  arquivamento?: ArquivamentoRecebeAqui;
};

export type RecebeAquiWebhookPayload = {
  EventType?: string;
  eventType?: string;
  EventDate?: string;
  eventDate?: string;
  externalReference?: string;
  ExternalReference?: string;
  checkout?: { externalReference?: string; id?: string };
  Checkout?: { externalReference?: string; id?: string };
  Payment?: {
    Id?: string;
    id?: string;
    PaymentType?: string;
    paymentType?: string;
    PaymentDate?: string;
    paymentDate?: string;
    PaidBy?: string;
    paidBy?: string;
    AmountPaid?: number;
    amountPaid?: number;
    Status?: string;
    status?: string;
    CardType?: string;
    cardType?: string;
    CardBrand?: string;
    cardBrand?: string;
    externalReference?: string;
    ExternalReference?: string;
  };
  payment?: RecebeAquiWebhookPayload['Payment'];
  paid?: boolean;
  success?: boolean;
};

type ParsedReference = {
  usuarioId: string;
  produto: ProdutoRecebeAqui;
  plano?: PlanoRecebeAqui;
  arquivamento?: ArquivamentoRecebeAqui;
  exp: number;
};

function segredo(): string {
  return process.env.RECEBEAQUI_WEBHOOK_SECRET || process.env.AUTH_SECRET || process.env.API_KEY || 'dfecentral-auth-secret';
}

function baseWebUrl(): string {
  return process.env.WEB_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:3003';
}

function baseApiUrl(): string {
  return process.env.RECEBEAQUI_API_BASE_URL || DEFAULT_API_BASE_URL;
}

function token(): string {
  const value = process.env.RECEBEAQUI_API_TOKEN?.trim();
  if (!value) throw new Error('RECEBEAQUI_API_TOKEN nao configurado');
  return value;
}

function getPlano(plano: string): (typeof PLANOS)[PlanoRecebeAqui] {
  const value = PLANOS[plano as PlanoRecebeAqui];
  if (!value) throw new Error(`Plano invalido: ${plano}`);
  return value;
}

function getArquivamento(codigo: string): (typeof ARQUIVAMENTO)[ArquivamentoRecebeAqui] {
  const value = ARQUIVAMENTO[codigo as ArquivamentoRecebeAqui];
  if (!value) throw new Error(`Arquivamento invalido: ${codigo}`);
  return value;
}

function signReference(input: ParsedReference): string {
  const base = `${input.usuarioId}|${input.produto}|${input.plano || ''}|${input.arquivamento || ''}|${input.exp}`;
  const sig = createHash('sha256').update(`${segredo()}|${base}`).digest('base64url');
  return `ra1.${input.produto}.${input.plano || '-'}${input.arquivamento ? `.${input.arquivamento}` : '.-'}.${input.usuarioId}.${input.exp}.${sig}`;
}

function parseReference(reference?: string): ParsedReference | null {
  if (!reference) return null;
  const parts = reference.split('.');
  if ((parts.length !== 6 && parts.length !== 7) || parts[0] !== 'ra1') return null;

  const produto = parts[1] as ProdutoRecebeAqui;
  const planoPart = parts[2];
  const arquivamentoPart = parts[3];
  const usuarioId = parts[4];
  const exp = Number(parts[5]);
  const sig = parts[6];

  if (!usuarioId || !Number.isFinite(exp)) return null;
  if (!['plano', 'arquivamento'].includes(produto)) return null;

  const plano = planoPart && planoPart !== '-' ? (planoPart as PlanoRecebeAqui) : undefined;
  const arquivamento = arquivamentoPart && arquivamentoPart !== '-' ? (arquivamentoPart as ArquivamentoRecebeAqui) : undefined;

  if (produto === 'plano' && !plano) return null;
  if (produto === 'arquivamento' && !arquivamento) return null;
  if (plano && !PLANOS[plano]) return null;
  if (arquivamento && !ARQUIVAMENTO[arquivamento]) return null;

  const expected = createHash('sha256').update(`${segredo()}|${usuarioId}|${produto}|${plano || ''}|${arquivamento || ''}|${exp}`).digest('base64url');
  if (expected !== sig) return null;
  if (Date.now() > exp) return null;

  return { usuarioId, produto, plano, arquivamento, exp };
}

function getPaymentLink(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = getPaymentLink(item);
      if (found) return found;
    }
    return null;
  }

  const record = payload as Record<string, unknown>;
  const keys = ['paymentLink', 'payment_link', 'checkoutUrl', 'checkout_url', 'url', 'link'];
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value;
  }

  for (const value of Object.values(record)) {
    const found = getPaymentLink(value);
    if (found) return found;
  }

  return null;
}

function normalizeAmount(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.round(value * 100);
}

async function consultarCheckout(indicador: string) {
  const headers = { Authorization: `Bearer ${token()}` };
  const consultas = [
    `${baseApiUrl()}/api/checkout?id=${encodeURIComponent(indicador)}`,
    `${baseApiUrl()}/api/checkout?externalReference=${encodeURIComponent(indicador)}`,
  ];

  for (const url of consultas) {
    const response = await fetch(url, { headers, cache: 'no-store' });
    if (!response.ok) continue;
    const data = (await response.json().catch(() => null)) as any;
    const checkout = data?.checkout || data?.dados || data;
    const externalReference = checkout?.externalReference || checkout?.ExternalReference || data?.externalReference || data?.ExternalReference;
    if (typeof externalReference === 'string' && externalReference.trim()) return externalReference.trim();
  }

  return null;
}

function extrairReferenciaWebhook(body: RecebeAquiWebhookPayload): string | null {
  const candidates = [
    body.externalReference,
    body.ExternalReference,
    body.Payment?.externalReference,
    body.Payment?.ExternalReference,
    body.payment?.externalReference,
    body.payment?.ExternalReference,
    body.checkout?.externalReference,
    body.Checkout?.externalReference,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }

  return null;
}

async function resolverReferenciaWebhook(body: RecebeAquiWebhookPayload): Promise<string | null> {
  const direta = extrairReferenciaWebhook(body);
  if (direta) return direta;

  const identificador =
    body.Payment?.Id ||
    body.Payment?.id ||
    body.payment?.Id ||
    body.payment?.id ||
    body.checkout?.id ||
    body.Checkout?.id;

  if (!identificador) return null;
  return consultarCheckout(String(identificador));
}

function campoStatus(body: RecebeAquiWebhookPayload): string {
  return String(body.EventType || body.eventType || body.Payment?.Status || body.payment?.status || '').toLowerCase();
}

export function montarReferenciaRecebeAqui(usuarioId: string, plano: PlanoRecebeAqui): string {
  const exp = Date.now() + 1000 * 60 * 60 * 24;
  return signReference({ usuarioId, produto: 'plano', plano, exp });
}

export function montarReferenciaRecebeAquiArquivamento(usuarioId: string, arquivamento: ArquivamentoRecebeAqui): string {
  const exp = Date.now() + 1000 * 60 * 60 * 24;
  return signReference({ usuarioId, produto: 'arquivamento', arquivamento, exp });
}

export function extrairReferenciaRecebeAqui(reference?: string): { usuarioId: string; plano: PlanoRecebeAqui } | null {
  const parsed = parseReference(reference);
  if (!parsed || parsed.produto !== 'plano' || !parsed.plano) return null;
  return { usuarioId: parsed.usuarioId, plano: parsed.plano };
}

export function extrairReferenciaRecebeAquiArquivamento(reference?: string): { usuarioId: string; arquivamento: ArquivamentoRecebeAqui } | null {
  const parsed = parseReference(reference);
  if (!parsed || parsed.produto !== 'arquivamento' || !parsed.arquivamento) return null;
  return { usuarioId: parsed.usuarioId, arquivamento: parsed.arquivamento };
}

export function pagamentoWebhookEstaPago(body: RecebeAquiWebhookPayload): boolean {
  if (body.paid || body.success) return true;

  const status = campoStatus(body);
  if (status.includes('aprov') || status.includes('paid') || status.includes('ativo') || status.includes('ativa')) return true;

  const amount = normalizeAmount(body.Payment?.AmountPaid ?? body.payment?.AmountPaid ?? body.Payment?.amountPaid ?? body.payment?.amountPaid);
  return typeof amount === 'number' && amount > 0;
}

export function planoRecebeAquiEhValido(plano: string): plano is PlanoRecebeAqui {
  return plano in PLANOS;
}

export function obterPrecoPlanoRecebeAqui(plano: PlanoRecebeAqui): number {
  return getPlano(plano).amount;
}

export function obterPrecoArquivamentoRecebeAqui(arquivamento: ArquivamentoRecebeAqui): number {
  return getArquivamento(arquivamento).amount;
}

export async function criarCheckoutRecebeAqui(input: RecebeAquiCheckoutInput): Promise<{ checkoutUrl: string; payload: unknown }> {
  const sucesso = `${baseWebUrl()}/dashboard?checkout=recebeaqui`;
  const erro = `${baseWebUrl()}/precos?erro=checkout_recebeaqui`;
  let body: Record<string, unknown>;

  if (input.produto === 'plano') {
    if (!input.plano) throw new Error('Plano nao informado');
    const planoInfo = getPlano(input.plano);
    body = {
      value: planoInfo.amount / 100,
      maxInstallmentCount: 12,
      billingType: 'CREDITO',
      recurrent: 'MENSAL',
      description: planoInfo.description,
      externalReference: montarReferenciaRecebeAqui(input.usuarioId, input.plano),
      customerName: input.nome,
      customerEmail: input.email,
      antifraud: true,
      successCallback: sucesso,
      errorCallback: erro,
    };
  } else {
    if (!input.arquivamento) throw new Error('Arquivamento nao informado');
    const arquivamentoInfo = getArquivamento(input.arquivamento);
    body = {
      value: arquivamentoInfo.amount / 100,
      maxInstallmentCount: 1,
      billingType: 'CREDITO_PIX_BOLETO',
      description: arquivamentoInfo.description,
      externalReference: montarReferenciaRecebeAquiArquivamento(input.usuarioId, input.arquivamento),
      customerName: input.nome,
      customerEmail: input.email,
      antifraud: true,
      successCallback: sucesso,
      errorCallback: erro,
    };
  }

  const response = await fetch(CHECKOUT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const error =
      (payload as any)?.detail ||
      (payload as any)?.message ||
      (payload as any)?.title ||
      `RecebeAqui retornou status ${response.status}`;
    throw new Error(String(error));
  }

  const checkoutUrl = getPaymentLink(payload);
  if (!checkoutUrl) {
    throw new Error('Nao foi possivel localizar a URL do checkout');
  }

  return { checkoutUrl, payload };
}

export async function resolverReferenciaRecebeAquiWebhook(body: RecebeAquiWebhookPayload): Promise<string | null> {
  return resolverReferenciaWebhook(body);
}
