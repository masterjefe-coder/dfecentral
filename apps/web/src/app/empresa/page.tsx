'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Usuario = { nome: string; email: string; cnpj?: string | null; plano?: string };
type Empresa = { id: string; nome: string; cnpj: string };
type MembroEquipe = { id: string; nome: string; cnpj: string; usuarioId: string; criadoEm: string };
type ConviteEquipe = { id: string; nome: string; email: string; papel: string; status: string; token: string; criadoEm: string };
type Assinatura = { plano: string; assinaturaStatus: string; assinaturaCancelEm?: string | null; assinaturaRenovaEm?: string | null };

export default function EmpresaPage() {
  const [aba, setAba] = useState<'dados' | 'equipe' | 'contabilidade'>('dados');
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [novaEmpresaNome, setNovaEmpresaNome] = useState('');
  const [novaEmpresaCnpj, setNovaEmpresaCnpj] = useState('');
  const [empresaAtiva, setEmpresaAtiva] = useState('');
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [contabilidadeEmail, setContabilidadeEmail] = useState('');
  const [contabilidadeAuto, setContabilidadeAuto] = useState(false);
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [convites, setConvites] = useState<ConviteEquipe[]>([]);
  const [novoConviteNome, setNovoConviteNome] = useState('');
  const [novoConviteEmail, setNovoConviteEmail] = useState('');
  const [novoConvitePapel, setNovoConvitePapel] = useState<'membro' | 'contabilidade' | 'admin'>('membro');
  const [xmlChave, setXmlChave] = useState('');
  const [xmlEmail, setXmlEmail] = useState('');
  const [enviandoXml, setEnviandoXml] = useState(false);
  const [pacoteMes, setPacoteMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [pacoteIncluirEntradas, setPacoteIncluirEntradas] = useState(false);
  const [enviandoPacote, setEnviandoPacote] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    void (async () => {
      const [meRes, empresasRes, ativaRes, prefsRes, equipeRes, assinaturaRes] = await Promise.all([
        fetch('/api/auth/me', { cache: 'no-store' }),
        fetch('/api/empresas', { cache: 'no-store' }),
        fetch('/api/empresas/ativa', { cache: 'no-store' }),
        fetch('/api/auth/prefs', { cache: 'no-store' }),
        fetch('/api/equipe', { cache: 'no-store' }),
        fetch('/api/billing/subscription', { cache: 'no-store' }),
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

      const prefsData = await prefsRes.json();
      if (prefsData.sucesso && prefsData.dados?.preferencias) {
        const prefs = prefsData.dados.preferencias as Record<string, unknown>;
        if (typeof prefs.contabilidadeEmail === 'string') setContabilidadeEmail(prefs.contabilidadeEmail);
        if (typeof prefs.contabilidadeEnvioAutomatico === 'boolean') setContabilidadeAuto(prefs.contabilidadeEnvioAutomatico);
      }

      const equipeData = await equipeRes.json();
      if (equipeData.sucesso) {
        setMembros(equipeData.dados?.membros || []);
        setConvites(equipeData.dados?.convites || []);
      }

      const assinaturaData = await assinaturaRes.json();
      if (assinaturaData.sucesso) {
        setAssinatura(assinaturaData.dados?.assinatura || null);
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

      await fetch('/api/auth/prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contabilidadeEmail: contabilidadeEmail || null,
          contabilidadeEnvioAutomatico: contabilidadeAuto,
        }),
      });

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

  async function convidarMembro() {
    const res = await fetch('/api/equipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: novoConviteNome, email: novoConviteEmail, papel: novoConvitePapel, cnpj }),
    });
    const data = await res.json();
    if (!data.sucesso) {
      setMensagem(data.erro || 'Nao foi possivel enviar o convite.');
      return;
    }

    setConvites((atual) => [data.dados.convite, ...atual]);
    setMensagem('Convite enviado por e-mail.');
    setNovoConviteNome('');
    setNovoConviteEmail('');
    setNovoConvitePapel('membro');
  }

  async function removerConvite(id: string) {
    const res = await fetch(`/api/equipe/convites/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.sucesso) {
      setMensagem(data.erro || 'Nao foi possivel remover o convite.');
      return;
    }

    setConvites((atual) => atual.filter((item) => item.id !== id));
    setMensagem('Convite removido.');
  }

  async function enviarXmlContabilidade() {
    if (!xmlChave.trim()) {
      setMensagem('Informe a chave do documento para enviar o XML.');
      return;
    }

    setEnviandoXml(true);
    setMensagem('');
    try {
      const res = await fetch('/api/contabilidade/xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: xmlChave.trim(), email: xmlEmail || undefined }),
      });
      const data = await res.json();
      if (!data.sucesso) {
        setMensagem(data.erro || 'Nao foi possivel enviar o XML.');
        return;
      }
      setMensagem(`XML enviado para ${data.dados?.email || 'contabilidade'}.`);
      setXmlChave('');
      setXmlEmail('');
    } finally {
      setEnviandoXml(false);
    }
  }

  async function enviarPacoteMensal() {
    if (!pacoteMes.trim()) {
      setMensagem('Informe o mes no formato AAAA-MM.');
      return;
    }

    setEnviandoPacote(true);
    setMensagem('');
    try {
      const res = await fetch('/api/contabilidade/pacote-mensal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes: pacoteMes.trim(), incluirEntradas: pacoteIncluirEntradas }),
      });
      const data = await res.json();
      if (!data.sucesso) {
        setMensagem(data.erro || 'Nao foi possivel gerar o pacote mensal.');
        return;
      }
      setMensagem(`Pacote ZIP de ${data.dados?.mes} enviado para ${data.dados?.email || 'contabilidade'} com ${data.dados?.total || 0} XMLs.`);
    } finally {
      setEnviandoPacote(false);
    }
  }

  async function baixarPacoteMensal() {
    if (!pacoteMes.trim()) {
      setMensagem('Informe o mes no formato AAAA-MM.');
      return;
    }

    setEnviandoPacote(true);
    setMensagem('');
    try {
      const res = await fetch('/api/contabilidade/pacote-mensal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes: pacoteMes.trim(), incluirEntradas: pacoteIncluirEntradas }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMensagem(data.erro || 'Nao foi possivel baixar o pacote mensal.');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `xmls-${pacoteMes.replace('-', '_')}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setMensagem('Download do ZIP iniciado.');
    } finally {
      setEnviandoPacote(false);
    }
  }

  async function cancelarAssinatura() {
    if (!window.confirm('Cancelar a assinatura? O acesso continua até a data informada e depois o plano volta para free.')) return;

    const res = await fetch('/api/billing/subscription/cancel', { method: 'POST' });
    const data = await res.json();
    if (!data.sucesso) {
      setMensagem(data.erro || 'Nao foi possivel cancelar a assinatura.');
      return;
    }
    setAssinatura((atual) => atual ? { ...atual, assinaturaStatus: 'cancelada', assinaturaCancelEm: data.dados?.cancelEm || atual.assinaturaCancelEm } : atual);
    setMensagem(`Assinatura cancelada. Acesso mantido até ${data.dados?.cancelEm ? new Date(data.dados.cancelEm).toLocaleDateString('pt-BR') : 'o fim do período atual'}.`);
  }

  async function restaurarAssinatura() {
    const res = await fetch('/api/billing/subscription/restore', { method: 'POST' });
    const data = await res.json();
    if (!data.sucesso) {
      setMensagem(data.erro || 'Nao foi possivel restaurar a assinatura.');
      return;
    }
    setAssinatura((atual) => atual ? { ...atual, assinaturaStatus: 'ativa', assinaturaCancelEm: null } : atual);
    setMensagem('Assinatura restaurada.');
  }

  async function renovarAgora() {
    const res = await fetch('/api/billing/subscription/renew-checkout', { method: 'POST' });
    const data = await res.json();
    if (!data.sucesso) {
      setMensagem(data.erro || 'Nao foi possivel gerar o checkout de renovacao.');
      return;
    }
    window.location.href = data.dados.checkoutUrl;
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
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dashboard" className="text-sm font-semibold text-slate-300 hover:text-white">Voltar ao dashboard</Link>
          <Link href="/auth/entrar" className="text-sm font-semibold text-slate-300 hover:text-white">Conta</Link>
        </div>

        <section className="surface-card rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur shadow-2xl shadow-black/20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Configuração da empresa</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Dados da conta</h1>
          <p className="mt-2 text-sm text-slate-300">Atualize o nome exibido e o CNPJ principal usado na operação.</p>

          <div className="mt-6 flex flex-wrap gap-2">
            {[
              ['dados', 'Dados'],
              ['equipe', 'Equipe'],
              ['contabilidade', 'Contabilidade'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAba(key as 'dados' | 'equipe' | 'contabilidade')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  aba === key ? 'bg-white text-slate-950' : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {aba === 'dados' ? (
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

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Assinatura</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-950">{assinatura?.plano?.toUpperCase() || usuario?.plano?.toUpperCase() || '-'}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white">{assinatura?.assinaturaStatus?.toUpperCase() || 'ATIVA'}</span>
              </div>
              <p className="mt-3 text-sm text-slate-300">
                {assinatura?.assinaturaCancelEm
                  ? `Se cancelada, o acesso termina em ${new Date(assinatura.assinaturaCancelEm).toLocaleDateString('pt-BR')}.`
                  : 'A assinatura está ativa e libera o acesso conforme o plano.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={renovarAgora} className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-slate-100">
                  Renovar agora
                </button>
                {assinatura?.assinaturaStatus === 'cancelada' ? (
                  <button onClick={restaurarAssinatura} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10">
                    Reativar
                  </button>
                ) : (
                  <button onClick={cancelarAssinatura} className="rounded-full border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/20">
                    Cancelar assinatura
                  </button>
                )}
                <Link href={`/precos?plano=${(assinatura?.plano || usuario?.plano || 'starter').toLowerCase()}`} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10">
                  Ver planos
                </Link>
              </div>
            </div>
          </div>
          ) : null}

          {aba === 'contabilidade' ? (
          <div className="mt-6 grid gap-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Contabilidade</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Field label="E-mail da contabilidade" value={contabilidadeEmail} onChange={setContabilidadeEmail} />
                <label className="block self-end rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                  <span className="mb-2 block text-sm font-medium text-slate-200">Enviar XML automaticamente</span>
                  <button
                    type="button"
                    onClick={() => setContabilidadeAuto((atual) => !atual)}
                    className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${contabilidadeAuto ? 'bg-emerald-400 text-slate-950' : 'bg-white/5 text-white border border-white/10'}`}
                  >
                    {contabilidadeAuto ? 'Ativado' : 'Desativado'}
                  </button>
                </label>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
                <Field label="Chave do XML" value={xmlChave} onChange={setXmlChave} />
                <Field label="E-mail opcional" value={xmlEmail} onChange={setXmlEmail} />
                <button onClick={enviarXmlContabilidade} disabled={enviandoXml} className="mt-auto inline-flex h-12 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:opacity-60">
                  {enviandoXml ? 'Enviando...' : 'Enviar XML'}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Pacote mensal</p>
              <p className="mt-2 text-sm text-slate-300">Gera um ZIP com os XMLs emitidos no mes e, se quiser, inclui os XMLs de entrada.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr_auto]">
                <Field label="Mês" value={pacoteMes} onChange={setPacoteMes} />
                <label className="block self-end rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                  <span className="mb-2 block text-sm font-medium text-slate-200">Incluir entradas</span>
                  <button
                    type="button"
                    onClick={() => setPacoteIncluirEntradas((atual) => !atual)}
                    className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${pacoteIncluirEntradas ? 'bg-emerald-400 text-slate-950' : 'bg-white/5 text-white border border-white/10'}`}
                  >
                    {pacoteIncluirEntradas ? 'Sim' : 'Nao'}
                  </button>
                </label>
                <button onClick={enviarPacoteMensal} disabled={enviandoPacote} className="mt-auto inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60">
                  {enviandoPacote ? 'Gerando...' : 'Enviar pacote ZIP'}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Fluxo contábil</p>
              <p className="mt-2 text-sm text-slate-300">Defina o e-mail padrão da contabilidade e use esta aba para disparos manuais por chave ou pacote mensal.</p>
            </div>
          </div>
          ) : null}

          {aba === 'equipe' ? (
          <div className="mt-6 grid gap-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Equipe</p>
              <p className="mt-2 text-sm text-slate-300">Convide pessoas por e-mail para acessar a mesma operação.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_160px_auto]">
                <Field label="Nome" value={novoConviteNome} onChange={setNovoConviteNome} />
                <Field label="E-mail" value={novoConviteEmail} onChange={setNovoConviteEmail} />
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-200">Papel</span>
                  <select value={novoConvitePapel} onChange={(e) => setNovoConvitePapel(e.target.value as any)} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none">
                    <option value="membro">Membro</option>
                    <option value="contabilidade">Contabilidade</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <button onClick={convidarMembro} className="mt-auto inline-flex h-12 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-slate-950 hover:bg-slate-100">Convidar</button>
              </div>

              <div className="mt-4 grid gap-3">
                {membros.length === 0 ? <p className="text-sm text-slate-400">Nenhum membro cadastrado.</p> : null}
                {membros.map((membro) => (
                  <div key={membro.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{membro.nome}</p>
                      <p className="font-mono text-xs text-slate-400">{membro.cnpj}</p>
                    </div>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-white">Acesso</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Convites pendentes</p>
                {convites.length === 0 ? <p className="text-sm text-slate-400">Nenhum convite pendente.</p> : null}
                {convites.map((convite) => (
                  <div key={convite.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{convite.nome}</p>
                      <p className="font-mono text-xs text-slate-400">{convite.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-white">{convite.papel}</span>
                      <button onClick={() => void removerConvite(convite.id)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10">Remover</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          ) : null}

          {mensagem ? <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">{mensagem}</p> : null}
          <button onClick={salvar} disabled={salvando} className="inline-flex w-fit rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:opacity-60">
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
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
