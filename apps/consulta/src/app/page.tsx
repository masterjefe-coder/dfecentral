'use client';

import { useState } from 'react';
import Link from 'next/link';

type TipoBusca = 'chave' | 'cnpj';

interface DocumentoEncontrado {
  chaveAcesso: string;
  tipo: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  cnpjEmitente: string;
  razaoSocialEmitente: string;
  cnpjDestinatario: string;
  valorTotal: string;
  status: string;
}

export default function ConsultaPage() {
  const [tipoBusca, setTipoBusca] = useState<TipoBusca>('chave');
  const [chaveAcesso, setChaveAcesso] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [resultado, setResultado] = useState<DocumentoEncontrado | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const formatarChave = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '').slice(0, 44);
    return apenasNumeros.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatarCNPJ = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '').slice(0, 14);
    return apenasNumeros
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
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

  const statusColor = (status: string) => {
    switch (status) {
      case 'autorizada':
        return 'text-green-600 bg-green-50';
      case 'cancelada':
        return 'text-red-600 bg-red-50';
      case 'denegada':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-yellow-600 bg-yellow-50';
    }
  };

  const handleBuscar = async () => {
    setCarregando(true);
    setErro('');
    setResultado(null);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.dfecentral.com.br';
      let url = '';

      if (tipoBusca === 'chave') {
        const chave = chaveAcesso.replace(/\s/g, '');
        if (chave.length !== 44) {
          setErro('Chave de acesso deve ter 44 dígitos');
          setCarregando(false);
          return;
        }
        url = `${baseUrl}/api/v1/nfe/${chave}`;
      } else {
        const cnpjLimpo = cnpj.replace(/\D/g, '');
        if (cnpjLimpo.length !== 14) {
          setErro('CNPJ deve ter 14 dígitos');
          setCarregando(false);
          return;
        }
        url = `${baseUrl}/api/v1/nfe?cnpj=${cnpjLimpo}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (!data.sucesso) {
        setErro(data.erro || 'Documento não encontrado');
        return;
      }

      if (tipoBusca === 'chave') {
        setResultado(data.dados);
      } else {
        // Lista de documentos
        setResultado(data.dados?.documentos?.[0] || null);
      }
    } catch {
      setErro('Erro ao consultar. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--secondary)]">
      {/* Header */}
      <header className="bg-[var(--background)] border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-[var(--primary)]">DFe</span>
            <span className="text-xl font-bold">Central</span>
          </Link>
          <span className="text-sm text-[var(--muted-foreground)]">Consulta Fiscal</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Consulte Documentos Fiscais
          </h1>
          <p className="text-[var(--muted-foreground)] text-lg">
            Insira a chave de acesso ou CNPJ para consultar qualquer documento fiscal eletrônico.
          </p>
        </div>

        {/* Card de Busca */}
        <div className="bg-[var(--background)] rounded-xl border border-[var(--border)] p-6 md:p-8 shadow-sm">
          {/* Tipo de Busca */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setTipoBusca('chave')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                tipoBusca === 'chave'
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--border)]'
              }`}
            >
              Chave de Acesso
            </button>
            <button
              onClick={() => setTipoBusca('cnpj')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                tipoBusca === 'cnpj'
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--border)]'
              }`}
            >
              CNPJ
            </button>
          </div>

          {/* Input */}
          <div className="mb-6">
            {tipoBusca === 'chave' ? (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Chave de Acesso (44 dígitos)
                </label>
                <input
                  type="text"
                  value={chaveAcesso}
                  onChange={(e) => setChaveAcesso(formatarChave(e.target.value))}
                  placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
                  className="w-full px-4 py-3 border border-[var(--border)] rounded-lg font-mono text-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-[var(--background)]"
                  maxLength={59}
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-2">
                  CNPJ do Emitente
                </label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(formatarCNPJ(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  className="w-full px-4 py-3 border border-[var(--border)] rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-[var(--background)]"
                  maxLength={18}
                />
              </div>
            )}
          </div>

          {/* Botão */}
          <button
            onClick={handleBuscar}
            disabled={carregando}
            className="w-full py-3 px-6 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-medium text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {carregando ? 'Consultando...' : 'Consultar'}
          </button>

          {/* Erro */}
          {erro && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
              {erro}
            </div>
          )}
        </div>

        {/* Resultado */}
        {resultado && (
          <div className="mt-8 bg-[var(--background)] rounded-xl border border-[var(--border)] p-6 md:p-8 shadow-sm">
            <h2 className="text-xl font-bold mb-6">Documento Encontrado</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-[var(--muted-foreground)]">Tipo</span>
                <p className="font-medium uppercase">{resultado.tipo}</p>
              </div>
              <div>
                <span className="text-sm text-[var(--muted-foreground)]">Status</span>
                <p className={`font-medium inline-block px-2 py-1 rounded ${statusColor(resultado.status)}`}>
                  {resultado.status}
                </p>
              </div>
              <div>
                <span className="text-sm text-[var(--muted-foreground)]">Número / Série</span>
                <p className="font-medium">{resultado.numero} / {resultado.serie}</p>
              </div>
              <div>
                <span className="text-sm text-[var(--muted-foreground)]">Data de Emissão</span>
                <p className="font-medium">{formatarData(resultado.dataEmissao)}</p>
              </div>
              <div>
                <span className="text-sm text-[var(--muted-foreground)]">CNPJ Emitente</span>
                <p className="font-medium font-mono">{formatarCNPJ(resultado.cnpjEmitente)}</p>
              </div>
              <div>
                <span className="text-sm text-[var(--muted-foreground)]">Razão Social</span>
                <p className="font-medium">{resultado.razaoSocialEmitente}</p>
              </div>
              {resultado.cnpjDestinatario && (
                <div>
                  <span className="text-sm text-[var(--muted-foreground)]">CNPJ Destinatário</span>
                  <p className="font-medium font-mono">{formatarCNPJ(resultado.cnpjDestinatario)}</p>
                </div>
              )}
              <div>
                <span className="text-sm text-[var(--muted-foreground)]">Valor Total</span>
                <p className="font-bold text-lg">{formatarMoeda(resultado.valorTotal)}</p>
              </div>
            </div>

            {/* Chave de Acesso */}
            <div className="mt-6 pt-4 border-t border-[var(--border)]">
              <span className="text-sm text-[var(--muted-foreground)]">Chave de Acesso</span>
              <p className="font-mono text-sm break-all mt-1">{resultado.chaveAcesso}</p>
            </div>

            {/* Ações */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button className="flex-1 py-2 px-4 border border-[var(--border)] rounded-lg font-medium hover:bg-[var(--secondary)] transition-colors">
                Download XML
              </button>
              <button className="flex-1 py-2 px-4 border border-[var(--border)] rounded-lg font-medium hover:bg-[var(--secondary)] transition-colors">
                Visualizar DANFE
              </button>
              <button className="flex-1 py-2 px-4 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-medium hover:opacity-90 transition-opacity">
                Compartilhar
              </button>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mt-12 text-center text-sm text-[var(--muted-foreground)]">
          <p>
            Consulta gratuita limitada. Para consultas ilimitadas,{' '}
            <Link href="https://www.dfecentral.com.br/auth/cadastrar" className="text-[var(--primary)] hover:underline">
              crie uma conta grátis
            </Link>.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-[var(--border)] bg-[var(--background)]">
        <div className="max-w-4xl mx-auto text-center text-sm text-[var(--muted-foreground)]">
          <p>© 2026 DFeCentral. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
