'use client';

import { useEffect, useRef, useState } from 'react';

type PlanoCheckout = 'starter' | 'pro' | 'enterprise';

export function CheckoutButton({ plano, label, autoStart = false }: { plano: PlanoCheckout; label: string; autoStart?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const autoStartDone = useRef(false);

  useEffect(() => {
    if (autoStartDone.current) return;
    const planoDaUrl = new URLSearchParams(window.location.search).get('plano') as PlanoCheckout | null;
    if (autoStart || planoDaUrl === plano) {
      autoStartDone.current = true;
      void iniciarCheckout();
    }
  }, [autoStart, plano]);

  async function iniciarCheckout() {
    setLoading(true);
    setErro('');

    try {
      const me = await fetch('/api/auth/session', { cache: 'no-store' });
      if (!me.ok) {
        window.location.href = `/auth/entrar?redirect=${encodeURIComponent(`/precos?plano=${plano}`)}`;
        return;
      }

      const response = await fetch('/api/billing/infinitepay/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano }),
      });
      const data = await response.json();

      if (!response.ok || !data?.sucesso) {
        if (response.status === 401) {
          window.location.href = `/auth/entrar?redirect=${encodeURIComponent(`/precos?plano=${plano}`)}`;
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
        Pagamento seguro via InfinitePay
      </p>
      {erro ? <p className="mt-2 text-sm text-rose-300">{erro}</p> : null}
    </div>
  );
}
