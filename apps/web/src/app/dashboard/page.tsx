'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type TipoImport = 'nfe' | 'nfce' | 'cte' | 'mdfe' | 'bpe' | 'cteos';
type TipoResumo = TipoImport | 'nfse' | 'dce';
type Movimento = 'emitidas' | 'recebidas';
type FiltroMovimento = Movimento | 'todas';

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

type ResumoMovimento = Record<TipoResumo, ResumoTipo>;

type AtividadeRecente = {
  id: string;
  tipo: string;
  consulta: string;
  resultado: string;
  ip?: string | null;
  criadoEm: string;
};

type ContaResumo = {
  vinculada: boolean;
  id?: string;
  nome?: string;
  email?: string;
  plano?: string;
  limiteMensal?: number | null;
  usoMensal?: number;
  restanteMensal?: number | null;
};

type XmlImportado = {
  nome: string;
  tipo: string;
  chaveAcesso: string;
};

type XmlImportacaoResultado = {
  importados: number;
  erros: Array<{ nome: string; erro: string }>;
  documentos: XmlImportado[];
};

type ArquivoImportacaoPreview = {
  nome: string;
  tipo: 'xml' | 'zip';
  status: 'ok' | 'warn' | 'erro';
  detalhe?: string;
};

const TIPOS_IMPORT: Array<{ tipo: TipoImport; nome: string; cor: string; descricao: string }> = [
  { tipo: 'nfe', nome: 'NF-e', cor: 'from-blue-500 to-indigo-600', descricao: 'Saídas e entradas da nota fiscal eletrônica.' },
  { tipo: 'nfce', nome: 'NFC-e', cor: 'from-emerald-500 to-teal-600', descricao: 'Consumidor final e operação de balcão.' },
  { tipo: 'cte', nome: 'CT-e', cor: 'from-violet-500 to-fuchsia-600', descricao: 'Conhecimento de transporte e logística.' },
  { tipo: 'mdfe', nome: 'MDF-e', cor: 'from-orange-500 to-amber-600', descricao: 'Manifesto e consolidação de carga.' },
  { tipo: 'bpe', nome: 'BP-e', cor: 'from-fuchsia-500 to-pink-600', descricao: 'Bilhete de passagem eletrônico.' },
  { tipo: 'cteos', nome: 'CT-e OS', cor: 'from-amber-500 to-yellow-600', descricao: 'Transporte eletrônico para outros serviços.' },
];

const TIPOS_RESUMO: Array<{ tipo: TipoResumo; nome: string; cor: string; descricao: string }> = [
  ...TIPOS_IMPORT,
  { tipo: 'nfse', nome: 'NFS-e', cor: 'from-slate-500 to-slate-700', descricao: 'Consulta pública e integração oficial de contribuintes.' },
  { tipo: 'dce', nome: 'DC-e', cor: 'from-cyan-500 to-sky-600', descricao: 'Declaração de conteúdo eletrônica.' },
];

function movimentoLabel(movimento: FiltroMovimento) {
  if (movimento === 'todas') return 'Todas';
  return movimento === 'emitidas' ? 'Saídas' : 'Entradas';
}

function resumoVazio(): ResumoMovimento {
  return {
    nfe: { total: 0, documentos: [] },
    nfce: { total: 0, documentos: [] },
    cte: { total: 0, documentos: [] },
    mdfe: { total: 0, documentos: [] },
    bpe: { total: 0, documentos: [] },
    cteos: { total: 0, documentos: [] },
    nfse: { total: 0, documentos: [] },
    dce: { total: 0, documentos: [] },
  };
}

function somarResumo(resumo: Record<Movimento, ResumoMovimento> | null): number {
  if (!resumo) return 0;
  let total = 0;
  for (const movimento of Object.values(resumo) as unknown as ResumoMovimento[]) {
    for (const item of Object.values(movimento) as unknown as ResumoTipo[]) {
      total += item.total;
    }
  }
  return total;
}

function mascaraCNPJ(valor: string) {
  const nums = valor.replace(/\D/g, '').slice(0, 14);
  return nums
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function nomeArquivo(file: File) {
  return file.webkitRelativePath || file.name;
}

function tipoArquivo(file: File): 'xml' | 'zip' {
  return file.name.toLowerCase().endsWith('.zip') ? 'zip' : 'xml';
}

function pareceXmlDocumento(texto: string) {
  return /<(?:nfeProc|NFe|procNFe|resNFe|resNFCe|cteProc|CTe|procCTe|mdfeProc|MDFe|procMDFe|procBPe|BPe|procDCe|DCe|resCTe|resMDFe|resBPe|resDCe)\b/i.test(texto);
}

async function arquivoParaBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binario = '';
  const bloco = 0x8000;
  for (let i = 0; i < bytes.length; i += bloco) {
    binario += String.fromCharCode(...bytes.subarray(i, i + bloco));
  }
  return btoa(binario);
}

export default function DashboardPage() {
  const [cnpj, setCnpj] = useState('');
  const [uf, setUf] = useState('SP');
  const [ultNSU, setUltNSU] = useState('000000000000000');
  const [filtroMovimento, setFiltroMovimento] = useState<FiltroMovimento>('todas');
  const [carregando, setCarregando] = useState<TipoImport | 'all' | null>(null);
  const [carregandoResumo, setCarregandoResumo] = useState(false);
  const [carregandoAtividades, setCarregandoAtividades] = useState(false);
  const [carregandoConta, setCarregandoConta] = useState(false);
  const [resultado, setResultado] = useState<{ tipo: string; importados: number; ultNSU?: string; erro?: string } | null>(null);
  const [resultadoXml, setResultadoXml] = useState<XmlImportacaoResultado | null>(null);
  const [resumo, setResumo] = useState<Record<Movimento, ResumoMovimento> | null>(null);
  const [atividades, setAtividades] = useState<AtividadeRecente[]>([]);
  const [conta, setConta] = useState<ContaResumo | null>(null);
  const [erroImportacao, setErroImportacao] = useState('');
  const [erroResumo, setErroResumo] = useState('');
  const [arquivosImportacao, setArquivosImportacao] = useState<File[]>([]);
  const [previewsImportacao, setPreviewsImportacao] = useState<ArquivoImportacaoPreview[]>([]);
  const [importandoXml, setImportandoXml] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const xmlInputRef = useRef<HTMLInputElement | null>(null);
  const pastaInputRef = useRef<HTMLInputElement | null>(null);

  const cnpjLimpo = useMemo(() => cnpj.replace(/\D/g, '').slice(0, 14), [cnpj]);
  const totalResumido = useMemo(() => somarResumo(resumo), [resumo]);
  const totalImportacoes = useMemo(() => atividades.filter((item) => item.tipo.startsWith('importacao:') && item.resultado.startsWith('sucesso')).length, [atividades]);

  useEffect(() => {
    pastaInputRef.current?.setAttribute('webkitdirectory', '');
    pastaInputRef.current?.setAttribute('directory', '');
  }, []);

  const prevalidarArquivos = useCallback(async (arquivos: File[]) => {
    const resultados = await Promise.all(arquivos.map(async (arquivo) => {
      const nome = nomeArquivo(arquivo);
      const tipo = tipoArquivo(arquivo);

      if (tipo === 'zip') {
        return { nome, tipo, status: 'warn' as const, detalhe: 'ZIP será expandido na importação.' };
      }

      const texto = await arquivo.text();
      if (!texto.trim()) return { nome, tipo, status: 'erro' as const, detalhe: 'Arquivo vazio.' };
      if (!pareceXmlDocumento(texto)) return { nome, tipo, status: 'warn' as const, detalhe: 'XML não parece ser um documento fiscal padrão.' };
      return { nome, tipo, status: 'ok' as const, detalhe: 'XML válido.' };
    }));

    setPreviewsImportacao(resultados);
    return resultados;
  }, []);

  const atualizarArquivosImportacao = useCallback(async (arquivos: FileList | File[] | null) => {
    const selecionados = Array.from(arquivos || []).filter((arquivo) => /\.(xml|zip)$/i.test(arquivo.name));
    setArquivosImportacao(selecionados);
    setErroImportacao('');
    setResultadoXml(null);
    await prevalidarArquivos(selecionados);
  }, [prevalidarArquivos]);

  const carregarResumoMovimento = useCallback(async (movimento: Movimento) => {
    const respostas = await Promise.all(
      TIPOS_RESUMO.map(async (item) => {
        const res = await fetch(`/api/documentos/${item.tipo}?cnpj=${cnpjLimpo}&movimento=${movimento}&limite=5`, { cache: 'no-store' });
        const data = await res.json();
        if (!data.sucesso) throw new Error(data.erro || `Falha ao carregar ${item.nome}`);
        return [item.tipo, { total: Number(data.dados?.total || 0), documentos: data.dados?.documentos || [] }] as const;
      }),
    );

    return Object.fromEntries(respostas) as ResumoMovimento;
  }, [cnpjLimpo]);

  const carregarAtividades = useCallback(async () => {
    if (cnpjLimpo.length !== 14) {
      setAtividades([]);
      return;
    }

    setCarregandoAtividades(true);
    try {
      const res = await fetch(`/api/consultas/recentes?cnpj=${cnpjLimpo}&limite=8`, { cache: 'no-store' });
      const data = await res.json();
      if (!data.sucesso) throw new Error(data.erro || 'Falha ao carregar atividades.');
      setAtividades(data.dados?.consultas || []);
    } catch {
      setAtividades([]);
    } finally {
      setCarregandoAtividades(false);
    }
  }, [cnpjLimpo]);

  const carregarConta = useCallback(async () => {
    setCarregandoConta(true);
    try {
      const res = await fetch('/api/conta', { cache: 'no-store' });
      const data = await res.json();
      if (!data.sucesso) throw new Error(data.erro || 'Falha ao carregar conta.');
      setConta(data.dados || null);
    } catch {
      setConta(null);
    } finally {
      setCarregandoConta(false);
    }
  }, []);

  const carregarResumo = useCallback(async () => {
    if (cnpjLimpo.length !== 14) {
      setResumo(null);
      return;
    }

    setCarregandoResumo(true);
    setErroResumo('');

    try {
      if (filtroMovimento === 'todas') {
        const [emitidas, recebidas] = await Promise.all([
          carregarResumoMovimento('emitidas'),
          carregarResumoMovimento('recebidas'),
        ]);

        setResumo({ emitidas, recebidas });
      } else {
        const dados = await carregarResumoMovimento(filtroMovimento);
        setResumo({
          emitidas: filtroMovimento === 'emitidas' ? dados : resumoVazio(),
          recebidas: filtroMovimento === 'recebidas' ? dados : resumoVazio(),
        });
      }
    } catch (error: any) {
      setErroResumo(error?.message || 'Nao foi possivel carregar o resumo.');
    } finally {
      setCarregandoResumo(false);
    }
  }, [carregarResumoMovimento, cnpjLimpo, filtroMovimento]);

  useEffect(() => {
    if (cnpjLimpo.length !== 14) {
      setResumo(null);
      setErroResumo('');
      return;
    }

    const timer = setTimeout(() => {
      void carregarResumo();
      void carregarAtividades();
      void carregarConta();
    }, 400);

    return () => clearTimeout(timer);
  }, [carregarResumo, carregarAtividades, carregarConta, cnpjLimpo, filtroMovimento]);

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
      for (const tipo of TIPOS_IMPORT) {
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

  const importarXmlSelecionados = async () => {
    if (arquivosImportacao.length === 0) {
      setErroImportacao('Selecione ao menos um XML ou uma pasta com XMLs.');
      return;
    }

    setImportandoXml(true);
    setErroImportacao('');
    setResultadoXml(null);

    try {
      const arquivos = await Promise.all(
        arquivosImportacao.map(async (arquivo) => {
          const nome = nomeArquivo(arquivo);
          if (tipoArquivo(arquivo) === 'zip') {
            return { nome, tipo: 'zip' as const, base64: await arquivoParaBase64(arquivo) };
          }

          return { nome, tipo: 'xml' as const, xml: await arquivo.text() };
        }),
      );

      const res = await fetch('/api/importacoes/xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arquivos }),
      });
      const data = await res.json();

      if (!data.sucesso) {
        setErroImportacao(data.erro || 'Falha ao importar XMLs.');
        return;
      }

      setResultadoXml({
        importados: Number(data.importados || 0),
        erros: Array.isArray(data.erros) ? data.erros : [],
        documentos: Array.isArray(data.documentos) ? data.documentos : [],
      });
      await carregarResumo();
      await carregarAtividades();
    } catch {
      setErroImportacao('Nao foi possivel importar os XMLs.');
    } finally {
      setImportandoXml(false);
    }
  };

  const onDropArquivos = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setArrastando(false);
    await atualizarArquivosImportacao(event.dataTransfer.files);
  };

  const sair = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/auth/entrar';
  };

  return (
    <div className="min-h-screen app-shell bg-slate-50 text-slate-900">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.10),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_28%)]" />
      <main className="relative mx-auto max-w-7xl px-4 py-6 sm:py-10">
        <div className="mb-8 rounded-[2rem] border border-slate-200 bg-white/90 p-5 sm:p-6 backdrop-blur shadow-2xl shadow-slate-900/10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Dashboard</p>
              <h1 className="mt-2 text-3xl sm:text-5xl font-bold tracking-tight">Central de Documentos</h1>
              <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-2xl">
                Centralize importação, consulta e acompanhamento dos documentos fiscais com certificado digital.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link href="/" className="inline-flex w-fit rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
                Voltar ao site
              </Link>
              <Link href="/empresa" className="inline-flex w-fit rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
                Empresa
              </Link>
              <Link href="/relatorios" className="inline-flex w-fit rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
                Relatórios
              </Link>
              <button onClick={sair} className="inline-flex w-fit rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
                Sair
              </button>
            </div>
          </div>
        </div>

        <Suspense fallback={null}>
          <CheckoutReturnBanner />
        </Suspense>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Tipos suportados', value: '6', sub: 'NF-e, NFC-e, CT-e, MDF-e, NFS-e, DC-e' },
            { label: 'Documentos no resumo', value: String(totalResumido || 0), sub: 'Saídas + entradas no CNPJ' },
            { label: 'Importações recentes', value: String(totalImportacoes || 0), sub: 'Entradas processadas nesta sessão' },
            { label: 'Status', value: 'Online', sub: 'Dashboard conectado' },
          ].map((item) => (
            <div key={item.label} className="surface-card-strong rounded-3xl p-5 text-slate-900">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">{item.value}</p>
              <p className="mt-1 text-sm text-slate-600">{item.sub}</p>
            </div>
          ))}
        </section>

        <section className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="surface-card-strong rounded-3xl p-5 text-slate-900">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Conta</p>
              <p className="mt-2 text-lg font-bold text-slate-950">{conta?.vinculada ? conta.nome : 'Sem vínculo de conta'}</p>
              <p className="mt-1 text-sm text-slate-600">{conta?.email || 'API key não vinculada a um usuário'}</p>
            </div>
          <div className="surface-card-strong rounded-3xl p-5 text-slate-900">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Plano</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{conta?.plano?.toUpperCase() || '-'}</p>
            <p className="mt-1 text-sm text-slate-600">
              {carregandoConta ? 'Carregando...' : conta?.limiteMensal === null ? 'Uso ilimitado' : `Limite mensal: ${conta?.limiteMensal || 0}`}
            </p>
            <button
              type="button"
              onClick={() => void carregarConta()}
              className="mt-4 inline-flex rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {carregandoConta ? 'Atualizando...' : 'Recarregar plano'}
            </button>
          </div>
          <div className="surface-card-strong rounded-3xl p-5 text-slate-900">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Uso do mês</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{conta?.usoMensal ?? 0}</p>
            <p className="mt-1 text-sm text-slate-600">
              {conta?.restanteMensal === null ? 'Sem limite configurado' : `${conta?.restanteMensal ?? 0} restantes`}
            </p>
          </div>
        </section>

        {resumo ? (
          <section className="mt-4 rounded-[2rem] border border-slate-200 bg-white/90 p-5 sm:p-6 backdrop-blur shadow-2xl shadow-slate-900/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Gráfico</p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">Distribuição por tipo</h2>
              </div>
              <Link href="/relatorios" className="text-sm font-semibold text-slate-600 hover:text-slate-950">Abrir relatórios</Link>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {TIPOS_RESUMO.map((item) => {
                const totalTipo = (resumo.emitidas[item.tipo]?.total || 0) + (resumo.recebidas[item.tipo]?.total || 0);
                const emitidasTotal = resumo.emitidas[item.tipo]?.total || 0;
                const recebidasTotal = resumo.recebidas[item.tipo]?.total || 0;
                const max = Math.max(1, ...TIPOS_RESUMO.map((t) => (resumo.emitidas[t.tipo]?.total || 0) + (resumo.recebidas[t.tipo]?.total || 0)));
                return (
                  <div key={item.tipo} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{item.nome}</p>
                      <span className="text-xs text-slate-500">{totalTipo}</span>
                    </div>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${(totalTipo / max) * 100}%` }} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                      <span>Saídas {emitidasTotal}</span>
                      <span>Entradas {recebidasTotal}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="surface-card-strong rounded-[2rem] text-slate-900 p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="section-kicker">Importação</p>
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

            <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Movimento</span>
                <select
                  value={filtroMovimento}
                  onChange={(e) => setFiltroMovimento(e.target.value as FiltroMovimento)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="todas">Todas</option>
                  <option value="emitidas">Saídas</option>
                  <option value="recebidas">Entradas</option>
                </select>
              </label>

              <p className="text-sm text-slate-500">
                Escolha a visão para o resumo recente. O filtro também vale para as consultas abaixo.
              </p>

              <button onClick={() => void carregarResumo()} disabled={carregandoResumo || cnpjLimpo.length !== 14} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-40">
                {carregandoResumo ? 'Carregando resumo...' : 'Atualizar resumo'}
              </button>
            </div>

            {(erroImportacao || erroResumo) && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erroImportacao || erroResumo}</div>
            )}

            {resultado && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <strong>{resultado.importados}</strong> documentos importados ({resultado.tipo}). Ult. NSU: {resultado.ultNSU || '-'}
              </div>
            )}

            {resultadoXml && (
              <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <strong>{resultadoXml.importados} XML(s) importado(s)</strong>
                  <span>{resultadoXml.erros.length} com aviso/erro</span>
                </div>
                {resultadoXml.documentos.length > 0 && (
                  <div className="mt-3 space-y-2 text-xs text-cyan-950">
                    {resultadoXml.documentos.slice(0, 5).map((doc) => (
                      <div key={`${doc.nome}-${doc.chaveAcesso}`} className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-cyan-200">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{doc.nome}</span>
                          <span className="font-mono">{doc.tipo.toUpperCase()}</span>
                        </div>
                        <p className="mt-1 truncate font-mono text-[11px]">{doc.chaveAcesso}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div
              className={`mt-4 rounded-3xl border border-dashed p-4 transition-colors ${arrastando ? 'border-cyan-500 bg-cyan-100/80' : 'border-cyan-300 bg-cyan-50/70'}`}
              onDragEnter={(e) => { e.preventDefault(); setArrastando(true); }}
              onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => void onDropArquivos(e)}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">Importação manual de XML e ZIP</p>
                  <h3 className="mt-2 text-lg font-bold text-slate-950">Saídas por arquivo, pasta ou pacote</h3>
                  <p className="mt-1 text-sm text-slate-600">Arraste os arquivos para cá ou selecione uma pasta. XMLs são validados antes do envio e ZIPs são expandidos na API.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => xmlInputRef.current?.click()}
                    className="rounded-full border border-cyan-200 bg-white px-4 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-100"
                  >
                    Selecionar arquivos
                  </button>
                  <button
                    type="button"
                    onClick={() => pastaInputRef.current?.click()}
                    className="rounded-full bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
                  >
                    Selecionar pasta
                  </button>
                  <button
                    type="button"
                    onClick={() => void importarXmlSelecionados()}
                    disabled={importandoXml || arquivosImportacao.length === 0}
                    className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
                  >
                    {importandoXml ? 'Importando...' : 'Importar selecionados'}
                  </button>
                </div>
              </div>

              <input
                ref={xmlInputRef}
                type="file"
                accept=".xml,.zip,application/xml,text/xml,application/zip"
                multiple
                className="hidden"
                onChange={(e) => void atualizarArquivosImportacao(e.target.files)}
              />
              <input
                ref={pastaInputRef}
                type="file"
                accept=".xml,.zip,application/xml,text/xml,application/zip"
                multiple
                className="hidden"
                onChange={(e) => void atualizarArquivosImportacao(e.target.files)}
              />

              <div className="mt-4 rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm text-slate-700">
                {arquivosImportacao.length === 0 ? (
                  <p>Nenhum arquivo selecionado.</p>
                ) : (
                  <div>
                    <p className="font-semibold text-slate-900">{arquivosImportacao.length} arquivo(s) selecionado(s)</p>
                    <p className="mt-1 text-xs text-slate-500">{arquivosImportacao.slice(0, 3).map((arquivo) => nomeArquivo(arquivo)).join(' | ')}{arquivosImportacao.length > 3 ? ' ...' : ''}</p>
                  </div>
                )}
              </div>

              {previewsImportacao.length > 0 && (
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {previewsImportacao.slice(0, 6).map((item) => (
                    <div key={`${item.nome}-${item.tipo}`} className={`rounded-2xl px-3 py-2 text-xs ring-1 ${item.status === 'erro' ? 'bg-rose-50 ring-rose-200 text-rose-900' : item.status === 'warn' ? 'bg-amber-50 ring-amber-200 text-amber-900' : 'bg-emerald-50 ring-emerald-200 text-emerald-900'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">{item.nome}</span>
                        <span className="font-mono">{item.tipo.toUpperCase()}</span>
                      </div>
                      <p className="mt-1">{item.detalhe}</p>
                    </div>
                  ))}
                </div>
              )}

              {resultadoXml?.erros?.length ? (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold">{resultadoXml.erros.length} arquivo(s) não importado(s)</p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {resultadoXml.erros.slice(0, 5).map((erro) => (
                      <li key={`${erro.nome}-${erro.erro}`}>{erro.nome}: {erro.erro}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {resumo && (
              <div className="mt-6 space-y-6">
                {((filtroMovimento === 'todas' ? ['emitidas', 'recebidas'] : [filtroMovimento]) as Movimento[]).map((movimento) => (
                  <section key={movimento} className="surface-card rounded-[2rem] bg-slate-50 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{movimentoLabel(movimento)}</p>
                        <h3 className="mt-1 text-xl font-bold text-slate-950">Documentos recentes</h3>
                      </div>
                      <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                        {TIPOS_RESUMO.reduce((acc, item) => acc + (resumo[movimento]?.[item.tipo]?.total || 0), 0)} itens
                      </span>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {TIPOS_RESUMO.map((item) => {
                        const dados = resumo[movimento]?.[item.tipo];
                        return (
                          <div key={`${movimento}-${item.tipo}`} className="surface-card rounded-3xl bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.nome}</p>
                                <p className="mt-2 text-2xl font-bold text-slate-950">{dados?.total || 0}</p>
                              </div>
                              <span className={`rounded-full bg-gradient-to-r ${item.cor} px-2.5 py-1 text-xs font-semibold text-white`}>{item.tipo.toUpperCase()}</span>
                            </div>
                            <div className="mt-4 space-y-2">
                              {(dados?.documentos || []).slice(0, 3).map((doc) => (
                                <div key={doc.chaveAcesso} className="rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
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
                  </section>
                ))}
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {TIPOS_IMPORT.map((item) => (
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
            <div className="surface-card-strong rounded-[2rem] p-6 shadow-2xl shadow-slate-900/10 backdrop-blur text-slate-900">
              <p className="section-kicker text-slate-500">Centralizador</p>
              <h3 className="mt-2 text-xl font-bold text-slate-950">Fluxo de trabalho</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>1. Informe CNPJ, UF e NSU.</li>
                <li>2. Importe por tipo ou tudo de uma vez.</li>
                <li>3. Os documentos entram na base e aparecem na consulta.</li>
              </ul>
            </div>

            <div className="surface-card-strong rounded-[2rem] p-6 shadow-2xl shadow-slate-900/10 backdrop-blur text-slate-900">
              <p className="section-kicker text-slate-500">Próximo passo</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                O dashboard já centraliza a importação e agora traz resumos separados de saídas e entradas por tipo.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                <Link href="/assinatura" className="rounded-full border border-slate-200 bg-white px-3 py-2 hover:bg-slate-100">Assinatura</Link>
                <Link href="/empresa" className="rounded-full border border-slate-200 bg-white px-3 py-2 hover:bg-slate-100">Empresa</Link>
                <Link href="/entradas" className="rounded-full border border-slate-200 bg-white px-3 py-2 hover:bg-slate-100">Entradas</Link>
                <Link href="/saidas" className="rounded-full border border-slate-200 bg-white px-3 py-2 hover:bg-slate-100">Saídas</Link>
                <Link href="/exportar" className="rounded-full border border-slate-200 bg-white px-3 py-2 hover:bg-slate-100">Exportar</Link>
              </div>
            </div>

            <div className="surface-card-strong rounded-[2rem] p-6 shadow-2xl shadow-slate-900/10 backdrop-blur text-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="section-kicker text-slate-500">Atividade</p>
                  <h3 className="mt-2 text-xl font-bold text-slate-950">Importações recentes</h3>
                </div>
                {carregandoAtividades && <span className="text-xs text-slate-500">carregando...</span>}
              </div>

              <div className="mt-4 space-y-3">
                {atividades.length === 0 ? (
                  <p className="text-sm text-slate-600">Sem importações recentes para este CNPJ.</p>
                ) : atividades.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{item.tipo}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${item.resultado.startsWith('sucesso') ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {item.resultado.startsWith('sucesso:') ? `${item.resultado.split(':')[1]} docs` : item.resultado}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-600">{item.consulta}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{new Date(item.criadoEm).toLocaleString('pt-BR')}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

function CheckoutReturnBanner() {
  const searchParams = useSearchParams();
  const [conta, setConta] = useState<ContaResumo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const planoAtivo = conta?.plano && conta.plano !== 'free' ? conta.plano.toUpperCase() : null;
  const estiloPlano = conta?.plano === 'starter' ? 'from-amber-400 to-orange-500' : conta?.plano === 'pro' ? 'from-cyan-400 to-blue-500' : 'from-fuchsia-400 to-violet-500';

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    async function verificarConta() {
      setCarregando(true);
      try {
        const res = await fetch('/api/conta', { cache: 'no-store' });
        const data = await res.json();
        if (data?.sucesso) {
          setConta(data.dados || null);
          if (data.dados?.plano && data.dados.plano !== 'free') {
            timeout = setTimeout(() => {
              window.location.replace('/dashboard');
            }, 1200);
            if (interval) clearInterval(interval);
          }
        }
      } catch {
        // Mantem o banner e tenta novamente no proximo ciclo.
      } finally {
        setCarregando(false);
      }
    }

    void verificarConta();
    interval = setInterval(() => {
      void verificarConta();
    }, 4000);

    return () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  const checkout = searchParams.get('checkout');
  if (checkout !== 'recebeaqui') return null;

  return (
    <div className={`mb-6 rounded-[1.5rem] border border-slate-200 bg-white/90 px-4 py-4 text-sm text-slate-900 shadow-2xl shadow-slate-900/10`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Assinatura</p>
          <p className="mt-1 text-sm text-slate-600">
            {planoAtivo ? (
              <span className="font-semibold text-emerald-700">Plano {planoAtivo} ativo. Atualizando o dashboard...</span>
            ) : carregando ? (
              'Aguardando confirmação da RecebeAqui...'
            ) : (
              'Checkout aberto na RecebeAqui. Quando o pagamento for aprovado, o plano é atualizado automaticamente via webhook.'
            )}
          </p>
        </div>
        {planoAtivo ? (
          <span className={`inline-flex rounded-full bg-gradient-to-r ${estiloPlano} px-3 py-1 text-xs font-semibold text-white`}>
            {planoAtivo}
          </span>
        ) : null}
      </div>
    </div>
  );
}
