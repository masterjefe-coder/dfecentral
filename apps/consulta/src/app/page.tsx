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
}

const MODELOS: Record<string, { tipo: string; label: string; cor: string }> = {
  '55': { tipo: 'nfe', label: 'NF-e', cor: 'bg-blue-100 text-blue-800' },
  '65': { tipo: 'nfce', label: 'NFC-e', cor: 'bg-green-100 text-green-800' },
  '57': { tipo: 'cte', label: 'CT-e', cor: 'bg-purple-100 text-purple-800' },
  '58': { tipo: 'mdfe', label: 'MDF-e', cor: 'bg-orange-100 text-orange-800' },
};

function detectarTipo(chave: string) {
  const nums = chave.replace(/\s/g, '');
  if (nums.length !== 44) return null;
  const modelo = nums.slice(20, 22);
  return MODELOS[modelo] || null;
}

export default function ConsultaPage() {
  const [chaveAcesso, setChaveAcesso] = useState('');
  const [resultado, setResultado] = useState<DocumentoEncontrado | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const infoChave = useMemo(() => detectarTipo(chaveAcesso), [chaveAcesso]);

  const formatarChave = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '').slice(0, 44);
    return apenasNumeros.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatarCNPJ = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    return apenasNumeros.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5'
    );
  };

  const formatarMoeda = (valor: string) => {
    const num = parseFloat(valor);
    if (isNaN(num)) return valor;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  };

  const formatarData = (data: string) => {
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
  };

  const statusBadge = (status: string) => {
    const cores: Record<string, string> = {
      autorizada: 'text-green-700 bg-green-50 border-green-200',
      cancelada: 'text-red-700 bg-red-50 border-red-200',
      denegada: 'text-red-700 bg-red-50 border-red-200',
    };
    return cores[status] || 'text-yellow-700 bg-yellow-50 border-yellow-200';
  };

  const handleBuscar = async () => {
    const chave = chaveAcesso.replace(/\s/g, '');
    if (chave.length !== 44) {
      setErro('Chave de acesso deve ter 44 dígitos');
      return;
    }

    if (!infoChave) {
      setErro('Tipo de documento não reconhecido nesta chave');
      return;
    }

    setCarregando(true);
    setErro('');
    setResultado(null);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.dfecentral.com.br';
      const response = await fetch(`${baseUrl}/api/v1/${infoChave.tipo}/${chave}`);
      const data = await response.json();

      if (!data.sucesso) {
        setErro(data.erro || 'Documento não encontrado');
        return;
      }

      setResultado(data.dados);
    } catch {
      setErro('Erro ao consultar. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight">
              <span className="text-blue-600">DFe</span>
              <span>Central</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500 hidden sm:inline">Consulta Fiscal</span>
            <Link href="https://www.dfecentral.com.br" className="text-blue-600 hover:text-blue-700 font-medium">
              Painel
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 md:py-16">
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-3xl md:text-5xl font-bold mb-3 tracking-tight">
            Consultar Documento Fiscal
          </h1>
          <p className="text-gray-500 text-lg">
            Insira a chave de acesso de 44 dígitos para consultar qualquer NF-e, NFC-e, CT-e ou MDF-e.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Chave de Acesso
          </label>
          <div className="relative">
            <input
              type="text"
              value={chaveAcesso}
              onChange={(e) => { setChaveAcesso(formatarChave(e.target.value)); setErro(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
              placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
              className="w-full px-4 py-3.5 border border-gray-300 rounded-xl font-mono text-lg tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-shadow"
              maxLength={59}
              autoFocus
            />
            {infoChave && chaveAcesso.replace(/\s/g, '').length === 44 && (
              <div className={`absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-full text-xs font-bold ${infoChave.cor}`}>
                {infoChave.label}
              </div>
            )}
          </div>

          <button
            onClick={handleBuscar}
            disabled={carregando || chaveAcesso.replace(/\s/g, '').length !== 44}
            className="w-full mt-4 py-3.5 px-6 bg-blue-600 text-white rounded-xl font-medium text-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {carregando ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Consultando...
              </span>
            ) : 'Consultar'}
          </button>

          {erro && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{erro}</span>
            </div>
          )}
        </div>

        {resultado && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center font-bold text-lg">
                  {resultado.tipo?.slice(0, 2).toUpperCase() || '?'}
                </div>
                <div>
                  <h2 className="font-bold text-lg">{resultado.tipo?.toUpperCase() || 'Documento'} Encontrado</h2>
                  <p className="text-blue-100 text-xs">Chave de Acesso válida</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusBadge(resultado.status)}`}>
                {resultado.status}
              </span>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Número</span>
                  <p className="font-semibold text-gray-900 mt-0.5">{resultado.numero}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Série</span>
                  <p className="font-semibold text-gray-900 mt-0.5">{resultado.serie}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Emissão</span>
                  <p className="font-semibold text-gray-900 mt-0.5">{formatarData(resultado.dataEmissao)}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Emitente</span>
                  <p className="font-semibold text-gray-900 mt-0.5">{resultado.razaoSocialEmitente}</p>
                  <p className="font-mono text-sm text-gray-500">{formatarCNPJ(resultado.cnpjEmitente)}</p>
                </div>
                {resultado.cnpjDestinatario && (
                  <div className="col-span-2">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Destinatário</span>
                    <p className="font-semibold text-gray-900 mt-0.5">{resultado.razaoSocialDestinatario}</p>
                    <p className="font-mono text-sm text-gray-500">{formatarCNPJ(resultado.cnpjDestinatario)}</p>
                  </div>
                )}
                <div className="md:col-start-3 md:row-start-2 flex flex-col justify-end">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Valor Total</span>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">{formatarMoeda(resultado.valorTotal)}</p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Chave de Acesso</span>
                <p className="font-mono text-sm text-gray-700 mt-1 break-all select-all">{resultado.chaveAcesso}</p>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-2">
                <button className="flex-1 py-2.5 px-4 border-2 border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors">
                  Download XML
                </button>
                <button className="flex-1 py-2.5 px-4 border-2 border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors">
                  Visualizar DANFE
                </button>
                <button className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors">
                  Compartilhar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-10 text-center text-sm text-gray-400 space-y-2">
          <p>
            Consulta gratuita limitada a 10 consultas/dia.{' '}
            <Link href="https://www.dfecentral.com.br/auth/cadastrar" className="text-blue-600 hover:text-blue-700 font-medium">
              Crie sua conta grátis
            </Link>
          </p>
        </div>
      </main>

      <footer className="py-6 px-4 border-t border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-400">
          <p>&copy; 2026 DFeCentral. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
