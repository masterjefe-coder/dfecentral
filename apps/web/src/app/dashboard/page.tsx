'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type TipoImport = 'nfe' | 'nfce' | 'cte' | 'mdfe';

type DocumentoResumo = {
  chaveAcesso: string;
  tipo: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  cnpjEmitente: string;
  valorTotal: string;
  status: string;
  fonte?: string;
};

type ResumoTipo = {
  total: number;
  documentos: DocumentoResumo[];
};

const TIPOS: Array<{ tipo: TipoImport; nome: string; cor: string; descricao: string }> = [
  { tipo: 'nfe', nome: 'NF-e', cor: 'from-blue-500 to-indigo-600', descricao: 'Saídas e entradas da nota fiscal eletrônica.' },
  { tipo: 'nfce', nome: 'NFC-e', cor: 'from-emerald-500 to-teal-600', descricao: 'Consumidor final e operação de balcão.' },
  { tipo: 'cte', nome: 'CT-e', cor: 'from-violet-500 to-fuchsia-600', descricao: 'Conhecimento de transporte e logística.' },
  { tipo: 'mdfe', nome: 'MDF-e', cor: 'from-orange-500 to-amber-600', descricao: 'Manifesto e consolidação de carga.' },
];

function mascaraCNPJ(valor: string) {
  const nums = valor.replace(/\D/g, '').slice(0, 14);
  return nums
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export default function DashboardPage() {
  const [cnpj, setCnpj] = useState('');
  const [uf, setUf] = useState('SP');
  const [ultNSU, setUltNSU] = useState('000000000000000');
  const [carregando, setCarregando] = useState<TipoImport | 'all' | null>(null);
  const [carregandoResumo, setCarregandoResumo] = useState(false);
  const [resultado, setResultado] = useState<{ tipo: string; importados: number; ultNSU?: string; erro?: string } | null>(null);
  const [resumo, setResumo] = useState<Record<TipoImport, ResumoTipo> | null>(null);
  const [erroImportacao, setErroImportacao] = useState('');
  const [erroResumo, setErroResumo] = useState('');

  const cnpjLimpo = useMemo(() => cnpj.replace(/\D/g, '').slice(0, 14), [cnpj]);

  const carregarResumo = useCallback(async () => {
    if (cnpjLimpo.length !== 14) {
      setResumo(null);
      return;
    }

    setCarregandoResumo(true);
    setErroResumo('');

    try {
      const respostas = await Promise.all(
        TIPOS.map(async (item) => {
          const res = await fetch(`/api/documentos/${item.tipo}?cnpj=${cnpjLimpo}&limite=5`, { cache: 'no-store' });
          const data = await res.json();
          if (!data.sucesso) throw new Error(data.erro || `Falha ao carregar ${item.nome}`);
          return [item.tipo, { total: Number(data.dados?.total || 0), documentos: data.dados?.documentos || [] }] as const;
        }),
      );

      setResumo(Object.fromEntries(respostas) as Record<TipoImport, ResumoTipo>);
    } catch (error: any) {
      setErroResumo(error?.message || 'Nao foi possivel carregar o resumo.');
    } finally {
      setCarregandoResumo(false);
    }
  }, [cnpjLimpo]);

  useEffect(() => {
    if (cnpjLimpo.length !== 14) {
      setResumo(null);
      setErroResumo('');
      return;
    }

    const timer = setTimeout(() => {
      void carregarResumo();
    }, 400);

    return () => clearTimeout(timer);
  }, [carregarResumo]);

  const importarTipo = async (tipo: TipoImport) => {
    if (cnpjLimpo.length !== 14) {
      setErroImportacao('Informe um CNPJ valido com 14 digitos.');
      return;
    }

    setCarregando(tipo);
    setErroImportacao('');
    setResultado(null);

    try {
      const res = await fetch(`/api/importacoes/${tipo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj: cnpjLimpo, uf, ultNSU }),
      });
      const data = await res.json();
      if (!data.sucesso) {
        setErroImportacao(data.erro || 'Falha ao importar documentos.');
        return;
      }

      setResultado({ tipo: data.tipo, importados: data.importados || 0, ultNSU: data.ultNSU });
    } catch {
      setErroImportacao('Nao foi possivel importar os documentos.');
    } finally {
      setCarregando(null);
    }
  };

  const importarTudo = async () => {
    if (cnpjLimpo.length !== 14) {
      setErroImportacao('Informe um CNPJ valido com 14 digitos.');
      return;
    }

    setCarregando('all');
    setErroImportacao('');
    setResultado(null);

    try {
      for (const tipo of TIPOS) {
        const res = await fetch(`/api/importacoes/${tipo.tipo}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cnpj: cnpjLimpo, uf, ultNSU }),
        });
        const data = await res.json();
        if (!data.sucesso) throw new Error(data.erro || `Falha ao importar ${tipo.nome}`);
        setResultado((prev) => ({ tipo: prev ? `${prev.tipo}, ${tipo.tipo.toUpperCase()}` : tipo.tipo.toUpperCase(), importados: (prev?.importados || 0) + (data.importados || 0), ultNSU: data.ultNSU }));
      }
      await carregarResumo();
    } catch (error: any) {
      setErroImportacao(error?.message || 'Nao foi possivel importar todos os documentos.');
    } finally {
      setCarregando(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_28%)]" />
      <main className="relative max-w-7xl mx-auto px-4 py-8 sm:py-12">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Dashboard</p>
            <h1 className="mt-2 text-3xl sm:text-5xl font-bold tracking-tight">Central de Documentos</h1>
            <p className="mt-3 text-sm sm:text-base text-slate-300 max-w-2xl">
              Centralize importação, consulta e acompanhamento dos documentos fiscais com certificado digital.
            </p>
          </div>
          <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
            Voltar ao site
          </Link>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Tipos suportados', value: '4', sub: 'NF-e, NFC-e, CT-e, MDF-e' },
            { label: 'Fluxo', value: 'Certificado', sub: 'Importação oficial SEFAZ' },
            { label: 'Saída', value: 'Banco + UI', sub: 'Base pronta para operação' },
            { label: 'Status', value: 'Online', sub: 'Dashboard conectado' },
          ].map((item) => (
            <div key={item.label} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-2xl shadow-black/20">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
              <p className="mt-2 text-2xl font-bold text-white">{item.value}</p>
              <p className="mt-1 text-sm text-slate-300">{item.sub}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="rounded-[2rem] border border-white/10 bg-white text-slate-900 p-6 sm:p-8 shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Importação</p>
                <h2 className="mt-2 text-2xl font-bold">Puxar documentos com certificado</h2>
              </div>
              <button onClick={importarTudo} disabled={!!carregando} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-40">
                {carregando === 'all' ? 'Importando...' : 'Importar tudo'}
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">CNPJ</span>
                <input
                  value={cnpj}
                  onChange={(e) => setCnpj(mascaraCNPJ(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">UF</span>
                <input
                  value={uf}
                  onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="SP"
                  maxLength={2}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ult. NSU</span>
                <input
                  value={ultNSU}
                  onChange={(e) => setUltNSU(e.target.value.replace(/\D/g, '').slice(0, 15).padStart(15, '0'))}
                  placeholder="000000000000000"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={() => void carregarResumo()} disabled={carregandoResumo || cnpjLimpo.length !== 14} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-40">
                {carregandoResumo ? 'Carregando resumo...' : 'Atualizar resumo'}
              </button>
              <p className="text-sm text-slate-500">Resumo por tipo e documentos mais recentes do CNPJ informado.</p>
            </div>

            {(erroImportacao || erroResumo) && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erroImportacao || erroResumo}</div>
            )}

            {resultado && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <strong>{resultado.importados}</strong> documentos importados ({resultado.tipo}). Ult. NSU: {resultado.ultNSU || '-'}
              </div>
            )}

            {resumo && (
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {TIPOS.map((item) => {
                  const dados = resumo[item.tipo];
                  return (
                    <div key={item.tipo} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.nome}</p>
                          <p className="mt-2 text-2xl font-bold text-slate-950">{dados?.total || 0}</p>
                        </div>
                        <span className={`rounded-full bg-gradient-to-r ${item.cor} px-2.5 py-1 text-xs font-semibold text-white`}>{item.tipo.toUpperCase()}</span>
                      </div>
                      <div className="mt-4 space-y-2">
                        {(dados?.documentos || []).slice(0, 3).map((doc) => (
                          <div key={doc.chaveAcesso} className="rounded-2xl bg-white px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-slate-900">{doc.numero || doc.chaveAcesso.slice(25, 34)}</span>
                              <span>{new Date(doc.dataEmissao).toLocaleDateString('pt-BR')}</span>
                            </div>
                            <p className="mt-1 truncate">{doc.chaveAcesso}</p>
                          </div>
                        ))}
                        {(dados?.documentos || []).length === 0 && <p className="text-sm text-slate-500">Sem documentos recentes.</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {TIPOS.map((item) => (
                <button
                  key={item.tipo}
                  onClick={() => void importarTipo(item.tipo)}
                  disabled={!!carregando}
                  className={`rounded-3xl bg-gradient-to-br ${item.cor} p-[1px] text-left disabled:opacity-50`}
                >
                  <div className="rounded-3xl bg-white px-5 py-4 h-full">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold text-slate-950">Importar {item.nome}</p>
                        <p className="mt-1 text-sm text-slate-600">{item.descricao}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold text-white bg-gradient-to-r ${item.cor}`}>{carregando === item.tipo ? '...' : 'Executar'}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Centralizador</p>
              <h3 className="mt-2 text-xl font-bold text-white">Fluxo de trabalho</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li>1. Informe CNPJ, UF e NSU.</li>
                <li>2. Importe por tipo ou tudo de uma vez.</li>
                <li>3. Os documentos entram na base e aparecem na consulta.</li>
              </ul>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Próximo passo</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                O dashboard já centraliza a importação. Agora falta conectar os resumos recentes e filtros por entrada/saída.
              </p>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
