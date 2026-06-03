import { createHash } from 'node:crypto';

const CHECKOUT_URL = 'https://api.checkout.infinitepay.io/links';

const PLANOS: Record<
  string,
  {
    amount: number;
    description: string;
  }
> = {
  starter: { amount: 4990, description: 'Plano Starter DFeCentral' },
  pro: { amount: 11990, description: 'Plano Pro DFeCentral' },
  enterprise: { amount: 19990, description: 'Plano Enterprise DFeCentral' },
};

const ARQUIVAMENTO: Record<
  string,
  {
    amount: number;
    description: string;
  }
> = {
  starter: { amount: 1990, description: 'Add-on XML Lite DFeCentral' },
  pro: { amount: 3990, description: 'Add-on XML Plus DFeCentral' },
};

export type PlanoCobrado = keyof typeof PLANOS;
export type ArquivamentoCobrado = keyof typeof ARQUIVAMENTO;
export type ProdutoCobrado = 'plano' | 'arquivamento';

export type InfinitePayCheckoutInput = {
  usuarioId: string;
  nome: string;
  email: string;
  produto: ProdutoCobrado;
  plano?: PlanoCobrado;
  arquivamento?: ArquivamentoCobrado;
};

export type InfinitePayWebhookPayload = {
  invoice_slug?: string;
  amount?: number;
  paid_amount?: number;
  installments?: number;
  capture_method?: string;
  transaction_nsu?: string;
  order_nsu?: string;
  receipt_url?: string;
  items?: unknown[];
  success?: boolean;
  paid?: boolean;
};

type ParsedOrder = {
  usuarioId: string;
  produto: ProdutoCobrado;
  plano?: PlanoCobrado;
  arquivamento?: ArquivamentoCobrado;
  exp: number;
};

function segredo(): string {
  return process.env.AUTH_SECRET || process.env.API_KEY || 'dfecentral-auth-secret';
}

function baseWebUrl(): string {
  return process.env.WEB_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:3003';
}

function baseApiUrl(): string {
  return process.env.API_PUBLIC_URL || 'http://127.0.0.1:3004';
}

function handle(): string {
  const value = process.env.INFINITEPAY_HANDLE?.trim();
  if (!value) throw new Error('INFINITEPAY_HANDLE nao configurada');
  return value.replace(/^\$/, '').replace(/\s+/g, '');
}

function getPlano(plano: string): (typeof PLANOS)[PlanoCobrado] {
  const value = PLANOS[plano as PlanoCobrado];
  if (!value) throw new Error(`Plano invalido: ${plano}`);
  return value;
}

function getArquivamento(codigo: string): (typeof ARQUIVAMENTO)[ArquivamentoCobrado] {
  const value = ARQUIVAMENTO[codigo as ArquivamentoCobrado];
  if (!value) throw new Error(`Arquivamento invalido: ${codigo}`);
  return value;
}

function signOrder(input: ParsedOrder): string {
  const base = `${input.usuarioId}|${input.produto}|${input.plano || ''}|${input.arquivamento || ''}|${input.exp}`;
  const sig = createHash('sha256').update(`${segredo()}|${base}`).digest('base64url');
  return `ip1.${input.produto}.${input.plano || '-'}${input.arquivamento ? `.${input.arquivamento}` : '.-'}.${input.usuarioId}.${input.exp}.${sig}`;
}

function parseOrder(orderNsu?: string): ParsedOrder | null {
  if (!orderNsu) return null;
  const parts = orderNsu.split('.');
  if ((parts.length !== 6 && parts.length !== 7) || parts[0] !== 'ip1') return null;

  const produto = parts[1] as ProdutoCobrado;
  const planoPart = parts[2];
  const arquivamentoPart = parts[3];
  const usuarioId = parts[4];
  const exp = Number(parts[5]);
  const sig = parts[6];

  if (!usuarioId || !Number.isFinite(exp)) return null;
  if (!['plano', 'arquivamento'].includes(produto)) return null;

  const plano = planoPart && planoPart !== '-' ? (planoPart as PlanoCobrado) : undefined;
  const arquivamento = arquivamentoPart && arquivamentoPart !== '-' ? (arquivamentoPart as ArquivamentoCobrado) : undefined;

  if (produto === 'plano' && !plano) return null;
  if (produto === 'arquivamento' && !arquivamento) return null;
  if (plano && !PLANOS[plano]) return null;
  if (arquivamento && !ARQUIVAMENTO[arquivamento]) return null;

  const expected = createHash('sha256').update(`${segredo()}|${usuarioId}|${produto}|${plano || ''}|${arquivamento || ''}|${exp}`).digest('base64url');
  if (expected !== sig) return null;

  if (Date.now() > exp) return null;
  return { usuarioId, produto, plano, arquivamento, exp };
}

function findCheckoutUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = findCheckoutUrl(item);
      if (found) return found;
    }
    return null;
  }

  const record = payload as Record<string, unknown>;
  const prioritizedKeys = ['checkout_url', 'checkoutUrl', 'url', 'link', 'payment_url', 'paymentUrl'];
  for (const key of prioritizedKeys) {
    const value = record[key];
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value;
  }

  for (const [key, value] of Object.entries(record)) {
    if (['redirect_url', 'webhook_url'].includes(key)) continue;
    const found = findCheckoutUrl(value);
    if (found) return found;
  }

  return null;
}

export function montarOrderNsu(usuarioId: string, plano: PlanoCobrado): string {
  const exp = Date.now() + 1000 * 60 * 60 * 24;
  return signOrder({ usuarioId, produto: 'plano', plano, exp });
}

export function montarOrderNsuArquivamento(usuarioId: string, arquivamento: ArquivamentoCobrado): string {
  const exp = Date.now() + 1000 * 60 * 60 * 24;
  return signOrder({ usuarioId, produto: 'arquivamento', arquivamento, exp });
}

export function extrairOrderNsu(orderNsu?: string): { usuarioId: string; plano: PlanoCobrado } | null {
  const parsed = parseOrder(orderNsu);
  if (!parsed) return null;
  if (parsed.produto !== 'plano' || !parsed.plano) return null;
  return { usuarioId: parsed.usuarioId, plano: parsed.plano };
}

export function extrairOrderNsuArquivamento(orderNsu?: string): { usuarioId: string; arquivamento: ArquivamentoCobrado } | null {
  const parsed = parseOrder(orderNsu);
  if (!parsed) return null;
  if (parsed.produto !== 'arquivamento' || !parsed.arquivamento) return null;
  return { usuarioId: parsed.usuarioId, arquivamento: parsed.arquivamento };
}

export function planoCobradoEhValido(plano: string): plano is PlanoCobrado {
  return plano in PLANOS;
}

export function obterPrecoPlano(plano: PlanoCobrado): number {
  return getPlano(plano).amount;
}

export function obterPrecoArquivamento(arquivamento: ArquivamentoCobrado): number {
  return getArquivamento(arquivamento).amount;
}

export async function criarCheckoutInfinitePay(input: InfinitePayCheckoutInput): Promise<{
  checkoutUrl: string;
  payload: unknown;
}> {
  const itens = [] as Array<{ quantity: number; price: number; description: string }>;
  let orderNsu = '';

  if (input.produto === 'plano') {
    if (!input.plano) throw new Error('Plano nao informado');
    const planoInfo = getPlano(input.plano);
    itens.push({ quantity: 1, price: planoInfo.amount, description: planoInfo.description });
    orderNsu = montarOrderNsu(input.usuarioId, input.plano);
  } else {
    if (!input.arquivamento) throw new Error('Arquivamento nao informado');
    const arquivamentoInfo = getArquivamento(input.arquivamento);
    itens.push({ quantity: 1, price: arquivamentoInfo.amount, description: arquivamentoInfo.description });
    orderNsu = montarOrderNsuArquivamento(input.usuarioId, input.arquivamento);
  }

  const redirectUrl = `${baseWebUrl()}/dashboard?checkout=infinitepay`;
  const webhookUrl = `${baseApiUrl()}/api/v1/billing/infinitepay/webhook`;

  const response = await fetch(CHECKOUT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      handle: handle(),
      order_nsu: orderNsu,
      redirect_url: redirectUrl,
      webhook_url: webhookUrl,
      customer: {
        name: input.nome,
        email: input.email,
      },
      itens,
    }),
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(`InfinitePay retornou status ${response.status}`);
  }

  const checkoutUrl = findCheckoutUrl(payload);
  if (!checkoutUrl) {
    throw new Error('Nao foi possivel localizar a URL do checkout');
  }

  return { checkoutUrl, payload };
}

export function webhookEstaPago(body: InfinitePayWebhookPayload): boolean {
  return Boolean(body.paid || body.success || (typeof body.paid_amount === 'number' && body.paid_amount > 0));
}

export function validarWebhookPlano(body: InfinitePayWebhookPayload): { usuarioId: string; plano: PlanoCobrado } | null {
  const parsed = extrairOrderNsu(body.order_nsu);
  if (!parsed) return null;

  const plano = getPlano(parsed.plano);
  if (typeof body.amount === 'number' && body.amount !== plano.amount) return null;

  return parsed;
}

export function validarWebhookArquivamento(body: InfinitePayWebhookPayload): { usuarioId: string; arquivamento: ArquivamentoCobrado } | null {
  const parsed = extrairOrderNsuArquivamento(body.order_nsu);
  if (!parsed) return null;

  const arquivo = getArquivamento(parsed.arquivamento);
  if (typeof body.amount === 'number' && body.amount !== arquivo.amount) return null;

  return parsed;
}
