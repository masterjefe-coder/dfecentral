'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, EmptyState, GlassCard } from '../components/ui';

interface DocumentoEncontrado {
  chaveAcesso: string;
  tipo: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  cnpjEmitente: string;
  razaoSocialEmitente?: string;
  cnpjDestinatario?: string;
  razaoSocialDestinatario?: string;
  valorTotal: string;
  status: string;
  fonte?: string;
  xml?: string;
}

type TipoConsulta = 'auto' | 'nfe' | 'nfce' | 'cte' | 'mdfe' | 'bpe' | 'cteos' | 'nfse' | 'dce';

const MODELOS: Record<string, { tipo: string; label: string; cor: string }> = {
  '55': { tipo: 'nfe', label: 'NF-e', cor: 'bg-blue-100 text-blue-700' },
  '65': { tipo: 'nfce', label: 'NFC-e', cor: 'bg-emerald-100 text-emerald-700' },
  '57': { tipo: 'cte', label: 'CT-e', cor: 'bg-violet-100 text-violet-700' },
  '58': { tipo: 'mdfe', label: 'MDF-e', cor: 'bg-orange-100 text-orange-700' },
  '63': { tipo: 'bpe', label: 'BP-e', cor: 'bg-fuchsia-100 text-fuchsia-700' },
  '67': { tipo: 'cteos', label: 'CT-e OS', cor: 'bg-amber-100 text-amber-700' },
  nfse: { tipo: 'nfse', label: 'NFS-e', cor: 'bg-slate-100 text-slate-700' },
  dce: { tipo: 'dce', label: 'DC-e', cor: 'bg-cyan-100 text-cyan-700' },
};

const TIPOS_CONSULTA: Array<{ value: TipoConsulta; label: string; ajuda: string }> = [
  { value: 'auto', label: 'Automático', ajuda: 'Detecta pelo tamanho da chave' },
  { value: 'nfe', label: 'NF-e', ajuda: '44 dígitos' },
  { value: 'nfce', label: 'NFC-e', ajuda: '44 dígitos' },
  { value: 'cte', label: 'CT-e', ajuda: '44 dígitos' },
  { value: 'mdfe', label: 'MDF-e', ajuda: '44 dígitos' },
  { value: 'bpe', label: 'BP-e', ajuda: '44 dígitos' },
  { value: 'cteos', label: 'CT-e OS', ajuda: '44 dígitos' },
  { value: 'nfse', label: 'NFS-e', ajuda: '50 caracteres' },
  { value: 'dce', label: 'DC-e', ajuda: '56 caracteres' },
];

const NFSE_DOCS = [
  { label: 'API de integração', href: 'https://www.gov.br/nfse/pt-br/municipios/produtos-disponiveis/api-de-integracao' },
  { label: 'APIs - Prod. Restrita e Produção', href: 'https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao' },
  { label: 'Documentação atual', href: 'https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual' },
];

const TIPOS_SEFAZ = new Set(['nfe', 'nfce', 'cte', 'mdfe', 'bpe', 'cteos']);

function formatarChaveDocumento(valor: string, tipo: TipoConsulta) {
  const limite = tipo === 'nfse' ? 50 : tipo === 'dce' ? 56 : tipo === 'auto' ? 56 : 44;
  const limpa = valor.replace(/\s/g, '').replace(/[^0-9A-Za-z]/g, '').slice(0, limite);
  return limpa.replace(/(.{4})(?=.)/g, '$1 ');
}

function detectarTipo(chave: string) {
  const limpa = chave.replace(/\s/g, '').replace(/[^0-9A-Za-z]/g, '');
  if (limpa.length === 44) {
    const modelo = limpa.slice(20, 22);
    return MODELOS[modelo] || null;
  }
  if (limpa.length === 50) return MODELOS.nfse;
  if (limpa.length === 56) return MODELOS.dce;
  return null;
}

function formatarCNPJ(valor: string) {
  const nums = valor.replace(/\D/g, '');
  return nums.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatarMoeda(valor: string) {
  const num = parseFloat(valor);
  if (Number.isNaN(num)) return valor;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

function formatarData(data: string) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(data));
  } catch {
    return data;
  }
}

export default function ConsultaPage() {
  const [tipoConsulta, setTipoConsulta] = useState<TipoConsulta>('auto');
  const [chaveAcesso, setChaveAcesso] = useState('');
  const [resultado, setResultado] = useState<DocumentoEncontrado | null>(null);
  const [erro, setErro] = useState('');
  const [carregandoConsulta, setCarregandoConsulta] = useState(false);

  const infoChaveDetectada = useMemo(() => detectarTipo(chaveAcesso), [chaveAcesso]);
  const infoChave = useMemo(() => {
    if (tipoConsulta === 'auto') return infoChaveDetectada;
    return Object.values(MODELOS).find((item) => item.tipo === tipoConsulta) || null;
  }, [tipoConsulta, infoChaveDetectada]);

  const chaveLimpa = useMemo(() => chaveAcesso.replace(/\s/g, '').replace(/[^0-9A-Za-z]/g, ''), [chaveAcesso]);

  const tipoEfetivo = useMemo(() => {
    if (tipoConsulta === 'auto') return infoChaveDetectada?.tipo || null;
    return tipoConsulta;
  }, [tipoConsulta, infoChaveDetectada]);

  const chaveValida = useMemo(() => {
    if (!tipoEfetivo) return false;
    if (tipoEfetivo === 'nfse') return chaveLimpa.length === 50;
    if (tipoEfetivo === 'dce') return chaveLimpa.length === 56;
    if (chaveLimpa.length !== 44) return false;
    if (tipoConsulta === 'auto') return !!infoChaveDetectada;
    return infoChaveDetectada?.tipo === tipoEfetivo;
  }, [tipoEfetivo, chaveLimpa, tipoConsulta, infoChaveDetectada]);

  useEffect(() => {
    setChaveAcesso((valor) => formatarChaveDocumento(valor, tipoConsulta));
  }, [tipoConsulta]);

  const consultarDireto = async (tipo: Exclude<TipoConsulta, 'auto'>) => {
    setCarregandoConsulta(true);
    setErro('');
    setResultado(null);

    try {
      const res = await fetch(`/api/consulta/${tipo}/${encodeURIComponent(chaveLimpa)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!data.sucesso || !data.dados) {
        setErro(data.erro || 'Nao foi possivel consultar o documento.');
        return false;
      }

      setResultado(data.dados);
      return true;
    } catch {
      setErro('Nao foi possivel consultar o documento.');
      return false;
    } finally {
      setCarregandoConsulta(false);
    }
  };

  const iniciarConsulta = async () => {
    if (!tipoEfetivo) {
      setErro('Escolha um tipo ou informe uma chave valida.');
      return;
    }

    if (!chaveValida) {
      setErro('A chave informada nao corresponde ao tipo selecionado.');
      return;
    }

    await consultarDireto(tipoEfetivo as Exclude<TipoConsulta, 'auto'>);
  };

  const limparChave = () => {
    setChaveAcesso('');
    setResultado(null);
    setErro('');
    setTipoConsulta('auto');
  };

  return (
    <div className="min-h-screen app-shell bg-transparent">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="DFeCentral" className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-slate-400 hidden sm:inline">Consulta Fiscal</span>
            <Link
              href="https://www.dfecentral.com.br"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
            >
              Painel &rarr;
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 sm:py-16">
        <div className="relative overflow-hidden rounded-[2rem] border border-slate-800/60 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.25),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.16),transparent_26%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-5 py-6 sm:px-8 sm:py-10 shadow-[0_20px_80px_rgba(2,6,23,0.45)] animate-fade-in text-white">
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(120deg,rgba(255,255,255,0.08),transparent_30%,rgba(255,255,255,0.02)_70%,transparent_100%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <section className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur">
                Consulta fiscal oficial
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </div>

              <div>
                <h1 className="max-w-2xl text-3xl sm:text-5xl font-bold tracking-tight text-white">
                  Consultar Documento Fiscal
                </h1>
                <p className="mt-3 max-w-2xl text-sm sm:text-base text-slate-300 leading-6">
                  Selecione o tipo, informe a chave e use a consulta oficial no backend para os documentos SEFAZ ou a consulta oficial para NFS-e.
                </p>
                {tipoConsulta === 'nfse' && (
                  <GlassCard className="mt-4 rounded-2xl border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
                    <p className="font-semibold text-white">NFS-e Nacional</p>
                    <p className="mt-1 leading-6 text-cyan-50/90">
                      A consulta nesta tela usa a API oficial de contribuintes do portal nacional com certificado digital no backend.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {NFSE_DOCS.map((doc) => (
                        <Link
                          key={doc.href}
                          href={doc.href}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-cyan-200/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/15 transition-colors"
                        >
                          {doc.label}
                        </Link>
                      ))}
                    </div>
                  </GlassCard>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <GlassCard className="rounded-2xl bg-white/10 px-4 py-3 shadow-sm backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Entrada</p>
                  <p className="mt-1 text-sm font-semibold text-white">Chave de acesso</p>
                </GlassCard>
                <GlassCard className="rounded-2xl bg-white/10 px-4 py-3 shadow-sm backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Modo</p>
                  <p className="mt-1 text-sm font-semibold text-white">Consulta direta</p>
                </GlassCard>
                <GlassCard className="rounded-2xl bg-white/10 px-4 py-3 shadow-sm backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Saida</p>
                  <p className="mt-1 text-sm font-semibold text-white">XML e PDF</p>
                </GlassCard>
              </div>

              <div className="surface-card-strong rounded-3xl p-5 sm:p-6 text-slate-900">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Tipo de documento
                </label>
                <select
                  value={tipoConsulta}
                  onChange={(e) => setTipoConsulta(e.target.value as TipoConsulta)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white"
                >
                  {TIPOS_CONSULTA.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label} - {item.ajuda}
                    </option>
                  ))}
                </select>

                <label className="block text-xs font-semibold text-slate-700 mt-4 mb-1.5 uppercase tracking-wider">
                  {tipoEfetivo ? `Chave de acesso ${tipoEfetivo.toUpperCase()}` : 'Chave de acesso'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={chaveAcesso}
                    onChange={(e) => {
                      setChaveAcesso(formatarChaveDocumento(e.target.value, tipoConsulta));
                      setErro('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && iniciarConsulta()}
                    placeholder={
                      tipoConsulta === 'nfse'
                        ? '0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 00'
                        : tipoConsulta === 'dce'
                          ? '0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 00'
                          : '0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 00'
                    }
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl font-mono text-base sm:text-lg tracking-wider focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white placeholder:text-slate-300 transition-shadow"
                    maxLength={69}
                    autoFocus
                  />
                  {infoChave && chaveLimpa.length > 0 && (
                    <Badge tone={tipoConsulta === 'nfse' ? 'cyan' : 'slate'}>
                      {infoChave.label}
                    </Badge>
                  )}
                </div>

                <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-2">
                  <span>Selecionado: <strong>{tipoConsulta === 'auto' ? 'automático' : tipoConsulta.toUpperCase()}</strong></span>
                  <span>Detectado: <strong>{infoChaveDetectada?.label || 'indefinido'}</strong></span>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={iniciarConsulta}
                    disabled={carregandoConsulta || !chaveValida || !tipoEfetivo}
                    className="w-full py-3.5 px-6 bg-slate-950 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-slate-950/10"
                  >
                    {carregandoConsulta ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Consultando...
                      </span>
                    ) : 'Consultar direto'}
                  </button>

                  <button
                    onClick={limparChave}
                    className="w-full py-3.5 px-6 border border-slate-300 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors"
                  >
                    Limpar chave
                  </button>
                </div>

                {erro && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2.5">
                    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{erro}</span>
                  </div>
                )}

                {!resultado && !erro && (
                  <EmptyState
                    title="Pronto para consultar"
                    description={'Os documentos usam consulta oficial no backend e podem gerar XML/PDF quando disponíveis.'}
                  />
                )}
              </div>
            </section>

            <aside className="space-y-4">
              <GlassCard className="rounded-3xl bg-slate-950 text-white p-5 shadow-xl shadow-slate-950/10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Fluxo</p>
                <ol className="mt-4 space-y-3 text-sm text-slate-200">
                  <li className="flex gap-3"><span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold">1</span><span>Digite a chave no formato correto do documento.</span></li>
                  <li className="flex gap-3"><span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold">2</span><span>Documentos SEFAZ consultam direto na API oficial do backend.</span></li>
                  <li className="flex gap-3"><span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold">3</span><span>NFS-e consulta na API oficial; DC-e segue no serviço oficial.</span></li>
                </ol>
              </GlassCard>

              <GlassCard className="rounded-3xl bg-white p-5 shadow-sm text-slate-900">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Dica</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  A consulta usa somente os servicos oficiais do backend.
                </p>
              </GlassCard>

              <GlassCard className="rounded-3xl bg-white p-5 shadow-sm text-slate-900">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Documento</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{infoChave?.label || 'Aguardando chave'}</p>
                    <p className="text-xs text-slate-500">Tipo detectado pela chave</p>
                  </div>
                  {infoChave && chaveLimpa.length > 0 ? (
                    <Badge tone={tipoConsulta === 'nfse' ? 'cyan' : 'slate'}>{infoChave.label}</Badge>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-500">incompleta</span>
                  )}
                </div>
              </GlassCard>
            </aside>
          </div>
        </div>

        {resultado && (
          <div className="mt-5 surface-card-strong rounded-[1.5rem] overflow-hidden animate-slide-up">
            <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  {resultado.tipo?.slice(0, 2).toUpperCase() || '?'}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">{resultado.tipo?.toUpperCase() || 'Documento'}</h2>
                  <p className="text-xs text-slate-400">Chave de acesso valida</p>
                </div>
              </div>
                <Badge tone={resultado.status === 'autorizada' ? 'emerald' : resultado.status === 'erro' ? 'red' : 'amber'}>
                  {resultado.status}
                </Badge>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Numero</span>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{resultado.numero}</p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Serie</span>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{resultado.serie}</p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Emissao</span>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatarData(resultado.dataEmissao)}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Emitente</span>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{resultado.razaoSocialEmitente || '-'}</p>
                  <p className="text-xs font-mono text-slate-500">{formatarCNPJ(resultado.cnpjEmitente)}</p>
                </div>
                {resultado.cnpjDestinatario && (
                  <div className="col-span-2">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Destinatario</span>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">{resultado.razaoSocialDestinatario || '-'}</p>
                    <p className="text-xs font-mono text-slate-500">{formatarCNPJ(resultado.cnpjDestinatario)}</p>
                  </div>
                )}
                <div className="flex flex-col justify-end">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Valor Total</span>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">{formatarMoeda(resultado.valorTotal)}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Chave de Acesso</span>
                <p className="font-mono text-xs text-slate-600 mt-1 break-all select-all">{resultado.chaveAcesso}</p>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                {resultado.xml ? (
                  <>
                    <a
                      href={['nfe', 'nfce', 'cte', 'mdfe', 'bpe', 'cteos'].includes(resultado.tipo)
                        ? `/api/consulta/${resultado.tipo}/${resultado.chaveAcesso}/xml`
                        : `data:text/xml;charset=utf-8,${encodeURIComponent(resultado.xml)}`}
                      download={`${resultado.chaveAcesso}.xml`}
                      className="flex-1 py-2.5 px-4 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all text-center"
                    >
                      Download XML
                    </a>
                    {['nfe', 'nfce', 'cte', 'mdfe', 'bpe', 'cteos'].includes(resultado.tipo) && (
                      <a
                        href={`/api/consulta/${resultado.tipo}/${resultado.chaveAcesso}/xml?format=danfe`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2.5 px-4 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all text-center"
                      >
                        Abrir PDF
                      </a>
                    )}
                  </>
                ) : (
                  <div className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 text-center">
                    Consulta realizada via API oficial de NFS-e. XML/PDF dependem da resposta do serviço.
                  </div>
                )}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(resultado.chaveAcesso);
                    alert('Chave copiada!');
                  }}
                  className="flex-1 py-2.5 px-4 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-all"
                >
                  Copiar Chave
                </button>
              </div>
              {resultado.fonte === 'scraper' && (
                <div className="mt-3 p-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs text-center">
                  Dados obtidos via serviço oficial SEFAZ
                </div>
              )}
              {resultado.fonte === 'mock' && (
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs text-center">
                  Dados simulados para demonstracao
                </div>
              )}
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          Consulta gratuita limitada a 10 consultas/dia.{' '}
          <Link href="https://www.dfecentral.com.br/auth/cadastrar" className="text-brand-600 hover:text-brand-700 font-medium">
            Crie sua conta gratis
          </Link>
        </p>
      </main>

      <footer className="py-6 border-t border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-slate-400">
          &copy; 2026 DFeCentral. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
