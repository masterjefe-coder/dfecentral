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
export type MetodoPagamentoAssinatura = 'cartao' | 'pix';

export type RecebeAquiCheckoutInput = {
  usuarioId: string;
  nome: string;
  email: string;
  produto: ProdutoRecebeAqui;
  plano?: PlanoRecebeAqui;
  arquivamento?: ArquivamentoRecebeAqui;
  metodoPagamento?: MetodoPagamentoAssinatura;
  taxId?: string;
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
  metodoPagamento: MetodoPagamentoAssinatura;
  exp: number;
};

const REFERENCE_PREFIX = 'ra1.';
const REFERENCE_PAYLOAD_BYTES = 31;
const REFERENCE_DATA_BYTES = 23;
const REFERENCE_TAG_BYTES = 8;

const PLANO_CODES: Record<PlanoRecebeAqui, number> = {
  starter: 0,
  pro: 1,
  enterprise: 2,
};

const ARQUIVAMENTO_CODES: Record<ArquivamentoRecebeAqui, number> = {
  starter: 0,
  pro: 1,
};

const PLANOS_BY_CODE: PlanoRecebeAqui[] = ['starter', 'pro', 'enterprise'];
const ARQUIVAMENTOS_BY_CODE: ArquivamentoRecebeAqui[] = ['starter', 'pro'];
const METODOS_PAGAMENTO_BY_CODE: MetodoPagamentoAssinatura[] = ['cartao', 'pix'];

function uuidToBytes(uuid: string): Uint8Array | null {
  const hex = uuid.replace(/-/g, '').trim();
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
  return Buffer.from(hex, 'hex');
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function assinaturaReferencia(data: Uint8Array): Uint8Array {
  return createHash('sha256').update(`${segredo()}|`).update(data).digest().subarray(0, REFERENCE_TAG_BYTES);
}

function buffersIguais(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

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
  const uuidBytes = uuidToBytes(input.usuarioId);
  if (!uuidBytes) throw new Error('Usuario invalido para referencia RecebeAqui');

  const payload = new Uint8Array(REFERENCE_PAYLOAD_BYTES);
  payload.set(uuidBytes, 0);
  payload[16] = input.produto === 'plano' ? 0 : 1;
  payload[17] = input.produto === 'plano' ? PLANO_CODES[input.plano || 'starter'] : ARQUIVAMENTO_CODES[input.arquivamento || 'starter'];
  payload[18] = input.metodoPagamento === 'pix' ? 1 : 0;
  new DataView(payload.buffer, payload.byteOffset, payload.byteLength).setUint32(19, Math.floor(input.exp / 1000), false);
  payload.set(assinaturaReferencia(payload.subarray(0, REFERENCE_DATA_BYTES)), REFERENCE_DATA_BYTES);

  return `${REFERENCE_PREFIX}${Buffer.from(payload).toString('base64url')}`;
}

function parseReference(reference?: string): ParsedReference | null {
  if (!reference?.startsWith(REFERENCE_PREFIX)) return null;

  try {
    const payload = Buffer.from(reference.slice(REFERENCE_PREFIX.length), 'base64url');
    if (payload.length !== REFERENCE_PAYLOAD_BYTES) return null;

    const data = payload.subarray(0, REFERENCE_DATA_BYTES);
    const sig = payload.subarray(REFERENCE_DATA_BYTES, REFERENCE_PAYLOAD_BYTES);
    const expected = assinaturaReferencia(data);
    if (!buffersIguais(expected, sig)) return null;

    const usuarioId = bytesToUuid(payload.subarray(0, 16));
    const produto = payload[16];
    const codigo = payload[17];
      const metodoPagamento = METODOS_PAGAMENTO_BY_CODE[payload[18]] || 'cartao';
    const exp = new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getUint32(19, false) * 1000;

    if (Date.now() > exp) return null;

    if (produto === 0) {
      const plano = PLANOS_BY_CODE[codigo];
      if (!plano) return null;
      return { usuarioId, produto: 'plano', plano, metodoPagamento, exp };
    }

    if (produto === 1) {
      const arquivamento = ARQUIVAMENTOS_BY_CODE[codigo];
      if (!arquivamento) return null;
      return { usuarioId, produto: 'arquivamento', arquivamento, metodoPagamento, exp };
    }

    return null;
  } catch {
    return null;
  }
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

export function montarReferenciaRecebeAqui(usuarioId: string, plano: PlanoRecebeAqui, metodoPagamento: MetodoPagamentoAssinatura = 'cartao'): string {
  const exp = Date.now() + 1000 * 60 * 60 * 24;
  return signReference({ usuarioId, produto: 'plano', plano, metodoPagamento, exp });
}

export function montarReferenciaRecebeAquiArquivamento(usuarioId: string, arquivamento: ArquivamentoRecebeAqui): string {
  const exp = Date.now() + 1000 * 60 * 60 * 24;
  return signReference({ usuarioId, produto: 'arquivamento', arquivamento, metodoPagamento: 'cartao', exp });
}

export function extrairReferenciaRecebeAqui(reference?: string): { usuarioId: string; plano: PlanoRecebeAqui; metodoPagamento: MetodoPagamentoAssinatura } | null {
  const parsed = parseReference(reference);
  if (!parsed || parsed.produto !== 'plano' || !parsed.plano) return null;
  return { usuarioId: parsed.usuarioId, plano: parsed.plano, metodoPagamento: parsed.metodoPagamento };
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

export async function criarCheckoutRecebeAqui(input: RecebeAquiCheckoutInput): Promise<{ checkoutUrl: string; externalReference: string; payload: unknown }> {
  const sucesso = `${baseWebUrl()}/dashboard?checkout=recebeaqui`;
  const erro = `${baseWebUrl()}/precos?erro=checkout_recebeaqui`;
  let body: Record<string, unknown>;
  const metodoPagamento = input.metodoPagamento || 'cartao';

  if (input.produto === 'plano') {
    if (!input.plano) throw new Error('Plano nao informado');
    const planoInfo = getPlano(input.plano);
    if (metodoPagamento === 'pix') {
      if (!input.taxId) throw new Error('TaxId nao informado para PIX');
      const vencimento = new Date(Date.now() + 1000 * 60 * 60 * 24 * 5);
      body = {
        value: planoInfo.amount / 100,
        maxInstallmentCount: 1,
        billingType: 'PIX',
        description: planoInfo.description,
        externalReference: montarReferenciaRecebeAqui(input.usuarioId, input.plano, metodoPagamento),
        customerName: input.nome,
        customerEmail: input.email,
        taxId: input.taxId,
        dueDate: vencimento.toISOString(),
        fine: 2,
        interest: 1,
        antifraud: true,
      };
    } else {
      body = {
        value: planoInfo.amount / 100,
        maxInstallmentCount: 12,
        billingType: 'CREDITO',
        recurrent: 'MENSAL',
        description: planoInfo.description,
        externalReference: montarReferenciaRecebeAqui(input.usuarioId, input.plano, metodoPagamento),
        customerName: input.nome,
        customerEmail: input.email,
        antifraud: true,
        successCallback: sucesso,
        errorCallback: erro,
      };
    }
  } else {
    if (!input.arquivamento) throw new Error('Arquivamento nao informado');
    const arquivamentoInfo = getArquivamento(input.arquivamento);
    body = {
      value: arquivamentoInfo.amount / 100,
      maxInstallmentCount: 1,
      billingType: 'PIX',
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

  const externalReference = typeof payload === 'object' && payload && 'externalReference' in payload && typeof (payload as any).externalReference === 'string'
    ? String((payload as any).externalReference)
    : '';

  return { checkoutUrl, externalReference, payload };
}

export async function resolverReferenciaRecebeAquiWebhook(body: RecebeAquiWebhookPayload): Promise<string | null> {
  return resolverReferenciaWebhook(body);
}
