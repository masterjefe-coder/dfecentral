'use client';

import { useMemo, useState } from 'react';
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
  xml?: string;
}

function formatarCNPJ(valor: string) {
  const nums = valor.replace(/\D/g, '');
  return nums.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatarMoeda(valor: string) {
  const num = Number.parseFloat(valor);
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
  const [chaveAcesso, setChaveAcesso] = useState('');
  const [resultado, setResultado] = useState<DocumentoEncontrado | null>(null);
  const [erro, setErro] = useState('');
  const [carregandoConsulta, setCarregandoConsulta] = useState(false);

  const chaveLimpa = useMemo(() => chaveAcesso.replace(/\s/g, '').replace(/[^0-9]/g, '').slice(0, 44), [chaveAcesso]);
  const chaveValida = chaveLimpa.length === 44;

  const formatarChave = (valor: string) => valor.replace(/\s/g, '').replace(/[^0-9]/g, '').slice(0, 44).replace(/(.{4})(?=.)/g, '$1 ');

  const consultar = async () => {
    if (!chaveValida) {
      setErro('Informe uma chave de 44 dígitos válida de NF-e.');
      return;
    }

    setCarregandoConsulta(true);
    setErro('');
    setResultado(null);

    try {
      const res = await fetch(`/api/consulta/nfe/${encodeURIComponent(chaveLimpa)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!data.sucesso || !data.dados) {
        setErro(data.erro || 'Nao foi possivel consultar a NF-e.');
        return;
      }

      setResultado(data.dados);
    } catch {
      setErro('Nao foi possivel consultar a NF-e.');
    } finally {
      setCarregandoConsulta(false);
    }
  };

  const limpar = () => {
    setChaveAcesso('');
    setResultado(null);
    setErro('');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 sm:py-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="DFeCentral" className="h-8 w-auto" />
          </Link>
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Consulta NF-e</span>
        </header>

        <section className="grid flex-1 place-items-center py-8 sm:py-10">
          <div className="w-full max-w-3xl">
            <div className="mb-6 space-y-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Consulta pública</p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Consultar NF-e</h1>
              <p className="mx-auto max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Informe a chave de acesso de 44 dígitos para consultar a NF-e e gerar XML ou PDF quando disponível.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-6">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Chave de acesso da NF-e</label>
              <input
                type="text"
                value={chaveAcesso}
                onChange={(e) => {
                  setChaveAcesso(formatarChave(e.target.value));
                  setErro('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && consultar()}
                placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 00"
                className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-4 font-mono text-base tracking-[0.18em] text-white outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-400/50"
                maxLength={53}
                autoFocus
              />

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={consultar}
                  disabled={carregandoConsulta || !chaveValida}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {carregandoConsulta ? 'Consultando...' : 'Consultar NF-e'}
                </button>
                <button
                  onClick={limpar}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Limpar
                </button>
              </div>

              {erro && (
                <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {erro}
                </div>
              )}
            </div>

            {resultado && (
              <div className="mt-5 rounded-[1.75rem] border border-white/10 bg-white p-5 text-slate-900 shadow-2xl shadow-black/20 sm:p-6">
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">Resultado</p>
                    <h2 className="mt-1 text-xl font-semibold">{resultado.tipo?.toUpperCase() || 'NF-e'}</h2>
                  </div>
                  <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {resultado.status}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Número" value={resultado.numero} />
                  <Field label="Série" value={resultado.serie} />
                  <Field label="Emissão" value={formatarData(resultado.dataEmissao)} />
                  <Field label="Emitente" value={resultado.razaoSocialEmitente || '-'} />
                  <Field label="CNPJ do Emitente" value={formatarCNPJ(resultado.cnpjEmitente)} />
                  <Field label="Valor Total" value={formatarMoeda(resultado.valorTotal)} />
                </div>

                {resultado.cnpjDestinatario && (
                  <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Destinatário</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{resultado.razaoSocialDestinatario || '-'}</p>
                    <p className="text-xs font-mono text-slate-500">{formatarCNPJ(resultado.cnpjDestinatario)}</p>
                  </div>
                )}

                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Chave de Acesso</p>
                  <p className="mt-1 break-all font-mono text-xs text-slate-700">{resultado.chaveAcesso}</p>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  {resultado.xml ? (
                    <>
                      <a
                        href={`/api/consulta/nfe/${resultado.chaveAcesso}/xml`}
                        className="inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
                      >
                        Baixar XML
                      </a>
                      <a
                        href={`/api/consulta/nfe/${resultado.chaveAcesso}/xml?format=danfe`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex flex-1 items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Abrir PDF
                      </a>
                    </>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
