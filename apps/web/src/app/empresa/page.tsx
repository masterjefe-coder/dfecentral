'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Usuario = { nome: string; email: string; cnpj?: string | null; plano?: string };
type Empresa = { id: string; nome: string; cnpj: string };

export default function EmpresaPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [novaEmpresaNome, setNovaEmpresaNome] = useState('');
  const [novaEmpresaCnpj, setNovaEmpresaCnpj] = useState('');
  const [empresaAtiva, setEmpresaAtiva] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    void (async () => {
      const [meRes, empresasRes, ativaRes] = await Promise.all([
        fetch('/api/auth/me', { cache: 'no-store' }),
        fetch('/api/empresas', { cache: 'no-store' }),
        fetch('/api/empresas/ativa', { cache: 'no-store' }),
      ]);
      const meData = await meRes.json();
      if (meData.sucesso) {
        const info = meData.dados?.usuario as Usuario;
        setUsuario(info);
        setNome(info?.nome || '');
        setCnpj(info?.cnpj || '');
      }

      const empresasData = await empresasRes.json();
      if (empresasData.sucesso) {
        setEmpresas(empresasData.dados?.empresas || []);
      }
      const ativaData = await ativaRes.json();
      if (ativaData.sucesso) {
        setEmpresaAtiva(ativaData.dados?.cnpjAtivo || '');
      }
    })();
  }, []);

  async function definirAtiva(cnpjAtivo: string) {
    const res = await fetch('/api/empresas/ativa', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cnpjAtivo }),
    });
    const data = await res.json();
    if (data.sucesso) {
      setEmpresaAtiva(data.dados?.cnpjAtivo || '');
    }
  }

  async function salvar() {
    setSalvando(true);
    setMensagem('');
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, cnpj }),
      });
      const data = await res.json();
      if (!data.sucesso) {
        setMensagem(data.erro || 'Nao foi possivel salvar.');
        return;
      }
      const info = data.dados?.usuario as Usuario;
      setUsuario(info);
      setMensagem('Dados atualizados.');

      if (cnpj.replace(/\D/g, '').length === 14) {
        await fetch('/api/empresas/ativa', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cnpjAtivo: cnpj }),
        });
        setEmpresaAtiva(cnpj.replace(/\D/g, '').slice(0, 14));
      }
    } finally {
      setSalvando(false);
    }
  }

  function adicionarEmpresa() {
    const cnpjLimpo = novaEmpresaCnpj.replace(/\D/g, '').slice(0, 14);
    if (!novaEmpresaNome.trim() || cnpjLimpo.length !== 14) {
      setMensagem('Informe nome e CNPJ valido para adicionar outra empresa.');
      return;
    }

    void (async () => {
      const res = await fetch('/api/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novaEmpresaNome.trim(), cnpj: cnpjLimpo }),
      });
      const data = await res.json();
      if (!data.sucesso) {
        setMensagem(data.erro || 'Nao foi possivel adicionar a empresa.');
        return;
      }

      setEmpresas((atual) => [data.dados.empresa, ...atual.filter((item) => item.cnpj !== cnpjLimpo)]);
      setNovaEmpresaNome('');
      setNovaEmpresaCnpj('');
      setMensagem('Empresa adicionada.');
      if (!empresaAtiva) {
        await fetch('/api/empresas/ativa', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cnpjAtivo: cnpjLimpo }),
        });
        setEmpresaAtiva(cnpjLimpo);
      }
    })();
  }

  function removerEmpresa(id: string) {
    void (async () => {
      const res = await fetch(`/api/empresas/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.sucesso) {
        setMensagem(data.erro || 'Nao foi possivel remover a empresa.');
        return;
      }

      setEmpresas((atual) => atual.filter((item) => item.id !== id));
      setMensagem('Empresa removida.');
    })();
  }

  return (
    <main className="min-h-screen app-shell bg-slate-950 px-4 py-10 text-white">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_28%)]" />
      <div className="relative mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm font-semibold text-slate-300 hover:text-white">Voltar ao dashboard</Link>
          <Link href="/auth/entrar" className="text-sm font-semibold text-slate-300 hover:text-white">Conta</Link>
        </div>

        <section className="surface-card rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur shadow-2xl shadow-black/20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Configuração da empresa</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Dados da conta</h1>
          <p className="mt-2 text-sm text-slate-300">Atualize o nome exibido e o CNPJ principal usado na operação.</p>

          <div className="mt-6 grid gap-4">
            <Field label="Nome" value={nome} onChange={setNome} />
            <Field label="CNPJ" value={cnpj} onChange={setCnpj} />
            <div className="grid gap-4 md:grid-cols-2">
              <Info label="E-mail" value={usuario?.email || '-'} />
              <Info label="Plano" value={usuario?.plano?.toUpperCase() || '-'} />
            </div>

            <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Multiempresa local</p>
              <p className="mt-2 text-sm text-slate-300">Lista auxiliar de CNPJs para uso rápido no dia a dia.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
                <Field label="Nome da empresa" value={novaEmpresaNome} onChange={setNovaEmpresaNome} />
                <Field label="CNPJ" value={novaEmpresaCnpj} onChange={setNovaEmpresaCnpj} />
                <button onClick={adicionarEmpresa} className="mt-auto inline-flex h-12 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-slate-950 hover:bg-slate-100">
                  Adicionar
                </button>
              </div>
              <div className="mt-4 grid gap-3">
                {empresas.length === 0 ? <p className="text-sm text-slate-400">Nenhuma empresa adicional cadastrada.</p> : null}
                {empresas.map((empresa) => (
                  <div key={empresa.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{empresa.nome}</p>
                      <p className="font-mono text-xs text-slate-400">{empresa.cnpj}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => void definirAtiva(empresa.cnpj)} className={`rounded-full px-3 py-1 text-xs font-semibold ${empresaAtiva === empresa.cnpj ? 'bg-emerald-400 text-slate-950' : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'}`}>
                        {empresaAtiva === empresa.cnpj ? 'Ativa' : 'Ativar'}
                      </button>
                      <button onClick={() => removerEmpresa(empresa.id)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10">
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Empresa ativa</p>
              <p className="mt-2 text-sm text-slate-300">{empresaAtiva || 'Nenhuma selecionada'}</p>
            </div>

            {mensagem ? <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">{mensagem}</p> : null}
            <button onClick={salvar} disabled={salvando} className="inline-flex w-fit rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:opacity-60">
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-200">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none focus:border-cyan-400/50" />
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
