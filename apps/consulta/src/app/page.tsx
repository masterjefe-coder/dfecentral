'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

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
}

const MODELOS: Record<string, { tipo: string; label: string; cor: string }> = {
  '55': { tipo: 'nfe', label: 'NF-e', cor: 'bg-blue-100 text-blue-700' },
  '65': { tipo: 'nfce', label: 'NFC-e', cor: 'bg-emerald-100 text-emerald-700' },
  '57': { tipo: 'cte', label: 'CT-e', cor: 'bg-violet-100 text-violet-700' },
  '58': { tipo: 'mdfe', label: 'MDF-e', cor: 'bg-orange-100 text-orange-700' },
};

const STATUS_CORES: Record<string, string> = {
  autorizada: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-700',
  denegada: 'bg-red-100 text-red-700',
};

function detectarTipo(chave: string) {
  const nums = chave.replace(/\s/g, '');
  if (nums.length !== 44) return null;
  const modelo = nums.slice(20, 22);
  return MODELOS[modelo] || null;
}

function formatarCNPJ(valor: string) {
  const nums = valor.replace(/\D/g, '');
  return nums.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatarMoeda(valor: string) {
  const num = parseFloat(valor);
  if (isNaN(num)) return valor;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

function formatarData(data: string) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(data));
  } catch { return data; }
}

export default function ConsultaPage() {
  const [chaveAcesso, setChaveAcesso] = useState('');
  const [resultado, setResultado] = useState<DocumentoEncontrado | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const infoChave = useMemo(() => detectarTipo(chaveAcesso), [chaveAcesso]);

  const formatarChave = (valor: string) => {
    const nums = valor.replace(/\D/g, '').slice(0, 44);
    return nums.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const handleBuscar = async () => {
    const chave = chaveAcesso.replace(/\s/g, '');
    if (chave.length !== 44) { setErro('A chave de acesso deve ter exatamente 44 dígitos.'); return; }
    if (!infoChave) { setErro('Tipo de documento não reconhecido nesta chave.'); return; }

    setCarregando(true);
    setErro('');
    setResultado(null);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.dfecentral.com.br';
      const res = await fetch(`${baseUrl}/api/v1/${infoChave.tipo}/${chave}`);
      const data = await res.json();
      if (!data.sucesso) { setErro(data.erro || 'Documento não encontrado.'); return; }
      setResultado(data.dados);
    } catch {
      setErro('Erro ao consultar. Verifique sua conexão e tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
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

      <main className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-2">
            Consultar Documento Fiscal
          </h1>
          <p className="text-sm sm:text-base text-slate-500">
            Insira a chave de acesso de 44 dígitos para consultar NF-e, NFC-e, CT-e ou MDF-e.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-sm animate-slide-up">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
            Chave de Acesso
          </label>
          <div className="relative">
            <input
              type="text"
              value={chaveAcesso}
              onChange={(e) => { setChaveAcesso(formatarChave(e.target.value)); setErro(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
              placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg font-mono text-base sm:text-lg tracking-wider focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white placeholder:text-slate-300 transition-shadow"
              maxLength={59}
              autoFocus
            />
            {infoChave && chaveAcesso.replace(/\s/g, '').length === 44 && (
              <div className={`absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-0.5 rounded-md text-xs font-bold ${infoChave.cor}`}>
                {infoChave.label}
              </div>
            )}
          </div>

          <button
            onClick={handleBuscar}
            disabled={carregando || chaveAcesso.replace(/\s/g, '').length !== 44}
            className="w-full mt-3 py-3 px-6 bg-slate-900 text-white rounded-lg font-semibold text-sm hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {carregando ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Consultando...
              </span>
            ) : 'Consultar'}
          </button>

          {erro && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2.5">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{erro}</span>
            </div>
          )}
        </div>

        {resultado && (
          <div className="mt-5 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-slide-up">
            <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  {resultado.tipo?.slice(0, 2).toUpperCase() || '?'}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">{resultado.tipo?.toUpperCase() || 'Documento'}</h2>
                  <p className="text-xs text-slate-400">Chave de acesso válida</p>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold ${STATUS_CORES[resultado.status] || 'bg-yellow-100 text-yellow-700'}`}>
                {resultado.status}
              </span>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Número</span>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{resultado.numero}</p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Série</span>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{resultado.serie}</p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Emissão</span>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatarData(resultado.dataEmissao)}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Emitente</span>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{resultado.razaoSocialEmitente || '—'}</p>
                  <p className="text-xs font-mono text-slate-500">{formatarCNPJ(resultado.cnpjEmitente)}</p>
                </div>
                {resultado.cnpjDestinatario && (
                  <div className="col-span-2">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Destinatário</span>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">{resultado.razaoSocialDestinatario || '—'}</p>
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
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || 'https://api.dfecentral.com.br'}/api/v1/${resultado.tipo}/${resultado.chaveAcesso}/xml`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-4 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all text-center"
                >
                  Download XML
                </a>
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || 'https://api.dfecentral.com.br'}/api/v1/${resultado.tipo}/${resultado.chaveAcesso}/xml?format=danfe`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-4 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all text-center"
                >
                  Visualizar DANFE
                </a>
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
                  Dados obtidos via consulta publica SEFAZ
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
            Crie sua conta grátis
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
