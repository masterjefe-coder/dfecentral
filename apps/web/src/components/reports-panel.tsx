'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

type Tipo = 'nfe' | 'nfce' | 'cte' | 'mdfe' | 'bpe' | 'cteos' | 'nfse' | 'dce';
type Movimento = 'todas' | 'emitidas' | 'recebidas';

type Documento = {
  chaveAcesso: string;
  tipo: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  cnpjEmitente: string;
  razaoSocialEmitente?: string | null;
  cnpjDestinatario?: string | null;
  razaoSocialDestinatario?: string | null;
  valorTotal?: string | null;
  status: string;
  fonte?: string;
};

type ReportsPanelProps = {
  mode: 'relatorios' | 'exportar';
  defaultMovimento?: Movimento;
  defaultTipo?: Tipo;
  title?: string;
  description?: string;
};

const TIPOS: Array<{ tipo: Tipo; nome: string }> = [
  { tipo: 'nfe', nome: 'NF-e' },
  { tipo: 'nfce', nome: 'NFC-e' },
  { tipo: 'cte', nome: 'CT-e' },
  { tipo: 'mdfe', nome: 'MDF-e' },
  { tipo: 'bpe', nome: 'BP-e' },
  { tipo: 'cteos', nome: 'CT-e OS' },
  { tipo: 'nfse', nome: 'NFS-e' },
  { tipo: 'dce', nome: 'DC-e' },
];

export function ReportsPanel({
  mode,
  defaultMovimento = 'todas',
  defaultTipo = 'nfe',
  title,
  description,
}: ReportsPanelProps) {
  const [cnpj, setCnpj] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [movimento, setMovimento] = useState<Movimento>(defaultMovimento);
  const [tipo, setTipo] = useState<Tipo>(defaultTipo);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [documentos, setDocumentos] = useState<Documento[]>([]);

  const cnpjLimpo = useMemo(() => cnpj.replace(/\D/g, '').slice(0, 14), [cnpj]);
  const documentosOrdenados = useMemo(
    () => [...documentos].sort((a, b) => new Date(b.dataEmissao).getTime() - new Date(a.dataEmissao).getTime()),
    [documentos],
  );
  const totalValor = useMemo(
    () => documentos.reduce((acc, doc) => acc + (Number(String(doc.valorTotal || '0').replace(',', '.')) || 0), 0),
    [documentos],
  );
  const porTipo = useMemo(() => {
    return TIPOS.map((item) => {
      const docsTipo = documentosOrdenados.filter((doc) => doc.tipo === item.tipo);
      const emitidas = docsTipo.filter((doc) => !(doc.cnpjDestinatario && doc.cnpjDestinatario === cnpjLimpo));
      const recebidas = docsTipo.filter((doc) => doc.cnpjDestinatario && doc.cnpjDestinatario === cnpjLimpo);
      return {
        tipo: item.nome,
        codigo: item.tipo,
        total: docsTipo.length,
        emitidas: emitidas.length,
        recebidas: recebidas.length,
        valorTotal: docsTipo.reduce((acc, doc) => acc + (Number(String(doc.valorTotal || '0').replace(/\./g, '').replace(',', '.')) || 0), 0),
      };
    });
  }, [cnpjLimpo, documentosOrdenados]);
  const maxTipo = Math.max(1, ...porTipo.map((item) => item.total));

  useEffect(() => {
    void (async () => {
      try {
        const [ativaRes, meRes, prefsRes] = await Promise.all([
          fetch('/api/empresas/ativa', { cache: 'no-store' }),
          fetch('/api/auth/me', { cache: 'no-store' }),
          fetch('/api/auth/prefs', { cache: 'no-store' }),
        ]);
        const ativaData = await ativaRes.json();
        const meData = await meRes.json();
        const prefsData = await prefsRes.json();
        const fallbackCnpj = meData.sucesso ? meData.dados?.usuario?.cnpj : '';
        const cnpjPreferido = ativaData.sucesso?.valueOf() && ativaData.dados?.cnpjAtivo ? ativaData.dados.cnpjAtivo : fallbackCnpj;
        if (cnpjPreferido && !cnpj) {
          setCnpj(cnpjPreferido);
        }
        if (prefsData.sucesso && prefsData.dados?.preferencias) {
          const prefs = prefsData.dados.preferencias as Record<string, string>;
          if (prefs.cnpjPadrao && !cnpjPreferido) setCnpj(prefs.cnpjPadrao);
          if (prefs.movimentoPadrao) setMovimento(prefs.movimentoPadrao as Movimento);
          if (prefs.tipoPadrao) setTipo(prefs.tipoPadrao as Tipo);
          if (prefs.inicioPadrao) setInicio(prefs.inicioPadrao);
          if (prefs.fimPadrao) setFim(prefs.fimPadrao);
        }
      } catch {
        // ignore
      }
    })();
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregar() {
    if (cnpjLimpo.length !== 14) {
      setErro('Informe um CNPJ valido com 14 digitos.');
      return;
    }

    setCarregando(true);
    setErro('');
    try {
      const params = new URLSearchParams({ cnpj: cnpjLimpo, movimento, pagina: '1', limite: '100' });
      if (inicio) params.set('inicio', inicio);
      if (fim) params.set('fim', fim);

      const res = await fetch(`/api/documentos/${tipo}?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!data.sucesso) {
        setErro(data.erro || 'Nao foi possivel carregar os documentos.');
        setDocumentos([]);
        return;
      }

      setDocumentos(data.dados?.documentos || []);
      await fetch('/api/auth/prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpjPadrao: cnpjLimpo,
          movimentoPadrao: movimento,
          tipoPadrao: tipo,
          inicioPadrao: inicio || null,
          fimPadrao: fim || null,
        }),
      });
    } catch {
      setErro('Nao foi possivel carregar os documentos.');
      setDocumentos([]);
    } finally {
      setCarregando(false);
    }
  }

  function exportarCsv() {
    const linhas = [
      ['movimento', 'chaveAcesso', 'tipo', 'numero', 'serie', 'dataEmissao', 'cnpjEmitente', 'cnpjDestinatario', 'valorTotal', 'status'],
      ...documentosOrdenados.map((doc) => [
        doc.cnpjDestinatario && doc.cnpjDestinatario === cnpjLimpo ? 'recebida' : 'emitida',
        doc.chaveAcesso,
        doc.tipo,
        doc.numero,
        doc.serie,
        doc.dataEmissao,
        doc.cnpjEmitente,
        doc.cnpjDestinatario || '',
        doc.valorTotal || '',
        doc.status,
      ]),
    ];

    const csv = `\ufeff${linhas.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${tipo}-${cnpjLimpo || 'sem-cnpj'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportarPdf() {
    if (cnpjLimpo.length !== 14) {
      setErro('Informe um CNPJ valido com 14 digitos.');
      return;
    }

    try {
      const params = new URLSearchParams({ cnpj: cnpjLimpo, tipo, movimento });
      if (inicio) params.set('inicio', inicio);
      if (fim) params.set('fim', fim);

      const res = await fetch(`/api/relatorios/pdf?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        setErro('Nao foi possivel gerar o PDF.');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-${tipo}-${cnpjLimpo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErro('Nao foi possivel gerar o PDF.');
    }
  }

  function exportarXlsx() {
    const parseValor = (valor?: string | null) => Number(String(valor || '0').replace(/\./g, '').replace(',', '.')) || 0;

    const resumo = [
      ['Campo', 'Valor'],
      ['CNPJ', cnpjLimpo],
      ['Tipo', TIPOS.find((item) => item.tipo === tipo)?.nome || tipo.toUpperCase()],
      ['Movimento', movimento],
      ['Início', inicio || '-'],
      ['Fim', fim || '-'],
      ['Total de documentos', String(documentosOrdenados.length)],
      ['Total emitidas', String(documentosOrdenados.filter((doc) => !(doc.cnpjDestinatario && doc.cnpjDestinatario === cnpjLimpo)).length)],
      ['Total recebidas', String(documentosOrdenados.filter((doc) => doc.cnpjDestinatario && doc.cnpjDestinatario === cnpjLimpo).length)],
      ['Valor total', totalValor ? totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'],
    ];

    const documentosPlanilha = documentosOrdenados.map((doc) => ({
      movimento: doc.cnpjDestinatario && doc.cnpjDestinatario === cnpjLimpo ? 'recebida' : 'emitida',
      chaveAcesso: doc.chaveAcesso,
      tipo: doc.tipo,
      numero: doc.numero,
      serie: doc.serie,
      dataEmissao: doc.dataEmissao,
      dataEmissaoBr: new Date(doc.dataEmissao).toLocaleDateString('pt-BR'),
      ano: new Date(doc.dataEmissao).getFullYear(),
      mes: String(new Date(doc.dataEmissao).getMonth() + 1).padStart(2, '0'),
      mesAno: `${String(new Date(doc.dataEmissao).getMonth() + 1).padStart(2, '0')}/${new Date(doc.dataEmissao).getFullYear()}`,
      cnpjEmitente: doc.cnpjEmitente,
      razaoSocialEmitente: doc.razaoSocialEmitente || '',
      cnpjDestinatario: doc.cnpjDestinatario || '',
      razaoSocialDestinatario: doc.razaoSocialDestinatario || '',
      valorTotal: doc.valorTotal || '',
      valorTotalNumerico: parseValor(doc.valorTotal),
      status: doc.status,
      fonte: doc.fonte || '',
    }));

    const emitidas = documentosPlanilha.filter((doc) => doc.movimento === 'emitida');
    const recebidas = documentosPlanilha.filter((doc) => doc.movimento === 'recebida');

    const workbook = XLSX.utils.book_new();
    const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
    const wsResumoBi = XLSX.utils.aoa_to_sheet([
      ['Tipo', 'Codigo', 'Total', 'Emitidas', 'Recebidas', 'Valor Total'],
      ...porTipo.map((row) => [row.tipo, row.codigo, row.total, row.emitidas, row.recebidas, row.valorTotal]),
    ]);
    const wsDocumentos = XLSX.utils.json_to_sheet(documentosPlanilha);
    const wsEmitidas = XLSX.utils.json_to_sheet(emitidas);
    const wsRecebidas = XLSX.utils.json_to_sheet(recebidas);

    wsResumo['!cols'] = [{ wch: 24 }, { wch: 36 }];
    wsResumoBi['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 16 }];
    const docCols = [
      { wch: 12 },
      { wch: 48 },
      { wch: 8 },
      { wch: 12 },
      { wch: 8 },
      { wch: 20 },
      { wch: 12 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 16 },
      { wch: 32 },
      { wch: 16 },
      { wch: 32 },
      { wch: 14 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
    ];
    wsDocumentos['!cols'] = docCols;
    wsEmitidas['!cols'] = docCols;
    wsRecebidas['!cols'] = docCols;

    wsDocumentos['!autofilter'] = { ref: `A1:R${Math.max(1, documentosPlanilha.length + 1)}` };
    wsEmitidas['!autofilter'] = { ref: `A1:R${Math.max(1, emitidas.length + 1)}` };
    wsRecebidas['!autofilter'] = { ref: `A1:R${Math.max(1, recebidas.length + 1)}` };
    XLSX.utils.book_append_sheet(workbook, wsResumo, 'Resumo');
    XLSX.utils.book_append_sheet(workbook, wsResumoBi, 'Resumo BI');
    XLSX.utils.book_append_sheet(workbook, wsDocumentos, 'Documentos');
    XLSX.utils.book_append_sheet(workbook, wsEmitidas, 'Emitidas');
    XLSX.utils.book_append_sheet(workbook, wsRecebidas, 'Recebidas');

    XLSX.writeFile(workbook, `relatorio-${tipo}-${cnpjLimpo || 'sem-cnpj'}.xlsx`, { compression: true });
  }

  return (
    <section className="surface-card-strong rounded-[2rem] border border-slate-200 bg-white/90 p-6 sm:p-8 backdrop-blur shadow-2xl shadow-slate-900/10 text-slate-900">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700">{mode === 'relatorios' ? 'Relatórios' : 'Exportação'}</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{title || (mode === 'relatorios' ? 'Visão consolidada' : 'Exportar documentos')}</h1>
      <p className="mt-2 text-slate-600">{description || 'Filtre por CNPJ, período, movimento e tipo.'}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {porTipo.map((item) => (
          <div key={item.codigo} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">{item.tipo}</p>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">{item.total}</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${(item.total / maxTipo) * 100}%` }} />
            </div>
            <p className="mt-3 text-xs text-slate-600">Emitidas {item.emitidas} · Recebidas {item.recebidas}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Field label="CNPJ" value={cnpj} onChange={setCnpj} />
        <Field label="Início" type="date" value={inicio} onChange={setInicio} />
        <Field label="Fim" type="date" value={fim} onChange={setFim} />
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Movimento</span>
          <select value={movimento} onChange={(e) => setMovimento(e.target.value as Movimento)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none">
            <option value="todas">Todas</option>
            <option value="emitidas">Saídas</option>
            <option value="recebidas">Entradas</option>
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none">
            {TIPOS.map((item) => <option key={item.tipo} value={item.tipo}>{item.nome}</option>)}
          </select>
        </label>

          <button onClick={carregar} disabled={carregando} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
          {carregando ? 'Carregando...' : 'Carregar'}
        </button>

        {mode === 'exportar' ? (
          <div className="flex flex-wrap gap-3">
            <button onClick={exportarCsv} disabled={!documentos.length} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60">
              Baixar CSV estruturado
            </button>
            <button onClick={exportarXlsx} disabled={!documentos.length} className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60">
              Baixar Excel (.xlsx)
            </button>
            <button onClick={exportarPdf} disabled={!documentos.length} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
              Baixar PDF
            </button>
          </div>
        ) : null}
      </div>

      {erro ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</p> : null}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Metric label="Total" value={String(documentos.length)} />
        <Metric label="Mais recente" value={documentos[0]?.dataEmissao ? new Date(documentos[0].dataEmissao).toLocaleDateString('pt-BR') : '-'} />
        <Metric label="Valor total" value={totalValor ? totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'} />
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Distribuição por tipo</p>
            <p className="mt-1 text-sm text-slate-600">Visão rápida para análise e BI.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          {porTipo.map((item) => (
            <div key={item.codigo} className="grid grid-cols-[72px_1fr_64px] items-center gap-3 text-sm">
              <span className="font-semibold text-slate-900">{item.codigo.toUpperCase()}</span>
              <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400" style={{ width: `${(item.total / maxTipo) * 100}%` }} />
              </div>
              <span className="text-right text-slate-600">{item.total}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Chave</th>
              <th className="px-4 py-3 text-left font-semibold">Número</th>
              <th className="px-4 py-3 text-left font-semibold">Data</th>
              <th className="px-4 py-3 text-left font-semibold">Valor</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {documentosOrdenados.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Nenhum documento carregado ainda.</td></tr>
            ) : documentosOrdenados.map((doc) => (
              <tr key={doc.chaveAcesso} className="text-slate-700">
                <td className="px-4 py-3 font-mono text-xs">{doc.chaveAcesso}</td>
                <td className="px-4 py-3">{doc.numero}</td>
                <td className="px-4 py-3">{new Date(doc.dataEmissao).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3">{doc.valorTotal || '-'}</td>
                <td className="px-4 py-3">{doc.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
        <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-4 py-2 hover:bg-slate-100">Dashboard</Link>
        <Link href="/empresa" className="rounded-full border border-slate-200 bg-white px-4 py-2 hover:bg-slate-100">Empresa</Link>
      </div>
    </section>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none" />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}
