'use client';

import { useEffect, useRef, useState } from 'react';

type PlanoCheckout = 'starter' | 'pro' | 'enterprise';
type ArquivamentoCheckout = 'starter' | 'pro';
type MetodoPagamentoCheckout = 'cartao' | 'pix';

async function obterCnpjAtivo(): Promise<string | null> {
  const [meRes, empresaRes] = await Promise.all([
    fetch('/api/auth/me', { cache: 'no-store' }),
    fetch('/api/empresas/ativa', { cache: 'no-store' }),
  ]);

  if (empresaRes.ok) {
    const empresaData = await empresaRes.json();
    const cnpjAtivo = empresaData?.dados?.cnpjAtivo;
    if (typeof cnpjAtivo === 'string' && cnpjAtivo.trim()) return cnpjAtivo.trim();
  }

  if (meRes.ok) {
    const meData = await meRes.json();
    const cnpj = meData?.dados?.usuario?.cnpj;
    if (typeof cnpj === 'string' && cnpj.trim()) return cnpj.trim();
  }

  return null;
}

export function CheckoutButton(
  { plano, label, autoStart = false, metodoPagamento = 'cartao' }: { plano: PlanoCheckout; label: string; autoStart?: boolean; metodoPagamento?: MetodoPagamentoCheckout },
) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const autoStartDone = useRef(false);

  useEffect(() => {
    if (autoStartDone.current) return;
    const params = new URLSearchParams(window.location.search);
    const planoDaUrl = params.get('plano') as PlanoCheckout | null;
    const metodoDaUrl = (params.get('metodo') as MetodoPagamentoCheckout | null) || 'cartao';
    if (autoStart || (planoDaUrl === plano && metodoDaUrl === metodoPagamento)) {
      autoStartDone.current = true;
      void iniciarCheckout();
    }
  }, [autoStart, plano, metodoPagamento]);

  async function iniciarCheckout() {
    setLoading(true);
    setErro('');

    try {
      const me = await fetch('/api/auth/session', { cache: 'no-store' });
      if (!me.ok) {
        window.location.href = `/auth/entrar?redirect=${encodeURIComponent(`/precos?plano=${plano}&metodo=${metodoPagamento}`)}`;
        return;
      }

      const cnpjAtivo = await obterCnpjAtivo();
      if (!cnpjAtivo) {
        window.location.href = `/empresa?aba=dados&erro=cnpj_assinatura`;
        return;
      }

      const response = await fetch('/api/billing/recebeaqui/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produto: 'plano', plano, metodoPagamento }),
      });
      const data = await response.json();

      if (!response.ok || !data?.sucesso) {
        if (response.status === 401) {
          window.location.href = `/auth/entrar?redirect=${encodeURIComponent(`/precos?plano=${plano}&metodo=${metodoPagamento}`)}`;
          return;
        }
        setErro(data?.erro || 'Nao foi possivel iniciar o checkout.');
        return;
      }

      window.location.href = data.dados.checkoutUrl;
    } catch {
      setErro('Nao foi possivel iniciar o checkout.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={iniciarCheckout}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition-all hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
        {loading ? 'Abrindo checkout...' : label}
      </button>
      <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
        {metodoPagamento === 'pix' ? 'Pagamento via PIX na RecebeAqui' : 'Pagamento recorrente via cartão na RecebeAqui'}
      </p>
      {erro ? <p className="mt-2 text-sm text-rose-300">{erro}</p> : null}
    </div>
  );
}

export function CheckoutAddonButton({
  arquivamento,
  label,
  autoStart = false,
}: {
  arquivamento: ArquivamentoCheckout;
  label: string;
  autoStart?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const autoStartDone = useRef(false);

  useEffect(() => {
    if (!autoStart || autoStartDone.current) return;
    autoStartDone.current = true;
    void iniciarCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  async function iniciarCheckout() {
    setLoading(true);
    setErro('');

    try {
      const me = await fetch('/api/auth/session', { cache: 'no-store' });
      if (!me.ok) {
        window.location.href = `/auth/entrar?redirect=${encodeURIComponent(`/precos?arquivamento=${arquivamento}`)}`;
        return;
      }

      const cnpjAtivo = await obterCnpjAtivo();
      if (!cnpjAtivo) {
        window.location.href = `/empresa?aba=dados&erro=cnpj_assinatura`;
        return;
      }

      const response = await fetch('/api/billing/recebeaqui/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produto: 'arquivamento', arquivamento }),
      });
      const data = await response.json();

      if (!response.ok || !data?.sucesso) {
        if (response.status === 401) {
          window.location.href = `/auth/entrar?redirect=${encodeURIComponent(`/precos?arquivamento=${arquivamento}`)}`;
          return;
        }
        setErro(data?.erro || 'Nao foi possivel iniciar o checkout.');
        return;
      }

      window.location.href = data.dados.checkoutUrl;
    } catch {
      setErro('Nao foi possivel iniciar o checkout.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={iniciarCheckout}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:-translate-y-0.5 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" /> : null}
        {loading ? 'Abrindo checkout...' : label}
      </button>
      {erro ? <p className="mt-2 text-sm text-rose-300">{erro}</p> : null}
    </div>
  );
}
