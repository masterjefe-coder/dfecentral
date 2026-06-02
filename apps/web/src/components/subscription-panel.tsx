'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Assinatura = {
  plano: string;
  assinaturaStatus: string;
  assinaturaCancelEm?: string | null;
  assinaturaRenovaEm?: string | null;
};

export function SubscriptionPanel() {
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    try {
      const res = await fetch('/api/billing/subscription', { cache: 'no-store' });
      const data = await res.json();
      if (data.sucesso) setAssinatura(data.dados?.assinatura || null);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function cancelar() {
    if (!window.confirm('Cancelar a assinatura? O acesso continua até a data exibida.')) return;
    const res = await fetch('/api/billing/subscription/cancel', { method: 'POST' });
    const data = await res.json();
    if (!data.sucesso) return setMensagem(data.erro || 'Nao foi possivel cancelar.');
    setMensagem(`Assinatura cancelada. Acesso até ${new Date(data.dados.cancelEm).toLocaleDateString('pt-BR')}.`);
    await carregar();
  }

  async function reativar() {
    const res = await fetch('/api/billing/subscription/restore', { method: 'POST' });
    const data = await res.json();
    if (!data.sucesso) return setMensagem(data.erro || 'Nao foi possivel reativar.');
    setMensagem('Assinatura reativada.');
    await carregar();
  }

  async function renovar() {
    const res = await fetch('/api/billing/subscription/renew-checkout', { method: 'POST' });
    const data = await res.json();
    if (!data.sucesso) return setMensagem(data.erro || 'Nao foi possivel gerar a renovacao.');
    window.location.href = data.dados.checkoutUrl;
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-white shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Assinatura</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Gerenciar plano</h1>
          </div>
          <Link href="/empresa" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
            Empresa
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Card label="Plano" value={assinatura?.plano?.toUpperCase() || '-'} />
          <Card label="Status" value={assinatura?.assinaturaStatus?.toUpperCase() || '-'} />
          <Card label="Renova em" value={assinatura?.assinaturaRenovaEm ? new Date(assinatura.assinaturaRenovaEm).toLocaleDateString('pt-BR') : '-'} />
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
          {assinatura?.assinaturaCancelEm
            ? `Cancelamento agendado para ${new Date(assinatura.assinaturaCancelEm).toLocaleDateString('pt-BR')}. O acesso continua até lá.`
            : 'A assinatura está ativa. Você pode cancelar, reativar ou renovar pelo checkout.'}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={renovar} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-100">
            Renovar agora
          </button>
          {assinatura?.assinaturaStatus === 'cancelada' ? (
            <button onClick={reativar} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
              Reativar
            </button>
          ) : (
            <button onClick={cancelar} className="rounded-full border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/20">
              Cancelar assinatura
            </button>
          )}
          <button onClick={() => void carregar()} disabled={carregando} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60">
            {carregando ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>

        {mensagem ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">{mensagem}</p> : null}
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-bold text-white">{value}</p>
    </div>
  );
}
