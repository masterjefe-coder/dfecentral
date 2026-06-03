'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Assinatura = {
  plano: string;
  assinaturaStatus: string;
  assinaturaMetodoPagamento?: string;
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
    const res = await fetch('/api/billing/subscription/renew-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ metodoPagamento: assinatura?.assinaturaMetodoPagamento || 'cartao' }) });
    const data = await res.json();
    if (!data.sucesso) return setMensagem(data.erro || 'Nao foi possivel gerar a renovacao.');
    window.location.href = data.dados.checkoutUrl;
  }

  async function trocarMetodo() {
    const metodoNovo = assinatura?.assinaturaMetodoPagamento === 'pix' ? 'cartao' : 'pix';
    const res = await fetch('/api/billing/subscription/renew-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ metodoPagamento: metodoNovo }) });
    const data = await res.json();
    if (!data.sucesso) return setMensagem(data.erro || 'Nao foi possivel gerar a troca de cobrança.');
    window.location.href = data.dados.checkoutUrl;
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 text-slate-900 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Assinatura</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Gerenciar plano</h1>
          </div>
          <Link href="/empresa" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            Empresa
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Card label="Plano" value={assinatura?.plano?.toUpperCase() || '-'} />
          <Card label="Status" value={assinatura?.assinaturaStatus?.toUpperCase() || '-'} />
          <Card label="Cobrança" value={(assinatura?.assinaturaMetodoPagamento || '-').toUpperCase()} />
          <Card label="Renova em" value={assinatura?.assinaturaRenovaEm ? new Date(assinatura.assinaturaRenovaEm).toLocaleDateString('pt-BR') : '-'} />
        </div>

        <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          {assinatura?.assinaturaCancelEm
            ? `Cancelamento agendado para ${new Date(assinatura.assinaturaCancelEm).toLocaleDateString('pt-BR')}. O acesso continua até lá.`
            : `A assinatura é recorrente mensal e usa ${assinatura?.assinaturaMetodoPagamento === 'pix' ? 'PIX' : 'cartão de crédito'}. Você pode cancelar, reativar ou mudar a cobrança.`}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={renovar} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Renovar agora
          </button>
          <button onClick={trocarMetodo} className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-100">
            {assinatura?.assinaturaMetodoPagamento === 'pix' ? 'Trocar para cartão' : 'Trocar para PIX'}
          </button>
          {assinatura?.assinaturaStatus === 'cancelada' ? (
            <button onClick={reativar} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              Reativar
            </button>
          ) : (
            <button onClick={cancelar} className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100">
              Cancelar assinatura
            </button>
          )}
          <button onClick={() => void carregar()} disabled={carregando} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60">
            {carregando ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>

        {mensagem ? <p className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{mensagem}</p> : null}
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}
