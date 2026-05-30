'use client';

import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { useParams } from 'next/navigation';

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

interface AssistResult {
  sucesso: boolean;
  dados?: DocumentoEncontrado;
  xml?: string;
  erro?: string;
  fonte: string;
}

interface AssistJobState {
  id: string;
  chaveAcesso: string;
  status: 'running' | 'aguardando_interacao' | 'concluido' | 'erro';
  erro?: string;
  mensagem?: string;
  result?: AssistResult;
  viewport: { width: number; height: number };
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

export default function AssistidoPopupPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [assistido, setAssistido] = useState<AssistJobState | null>(null);
  const [assistidoTexto, setAssistidoTexto] = useState('');
  const [assistidoFrameTick, setAssistidoFrameTick] = useState(0);
  const [erro, setErro] = useState('');

  const notificarOpener = (tipo: 'assistido:atualizar', jobId: string) => {
    try {
      window.opener?.postMessage({ tipo, id: jobId }, window.location.origin);
    } catch {}
  };

  const fecharPopup = () => {
    try {
      window.close();
    } catch {}
  };

  const assistidoFrameUrl = assistido?.id ? `/api/assistido/${assistido.id}/frame?ts=${assistidoFrameTick}` : '';

  const atualizarAssistido = async (jobId: string) => {
    const res = await fetch(`/api/assistido/${jobId}/state`, { cache: 'no-store' });
    const data = await res.json();
    if (!data.sucesso || !data.job) return null;

    setAssistido(data.job);
    if (data.job.status === 'erro') {
      setErro(data.job.erro || data.job.result?.erro || 'Consulta assistida falhou.');
      notificarOpener('assistido:atualizar', data.job.id);
    }

    if (data.job.status === 'concluido') {
      notificarOpener('assistido:atualizar', data.job.id);
      window.setTimeout(() => fecharPopup(), 1200);
    }

    return data.job as AssistJobState;
  };

  useEffect(() => {
    if (!id) return;

    void atualizarAssistido(id);
    const timer = window.setInterval(() => {
      void atualizarAssistido(id).then((job) => {
        if (job) setAssistidoFrameTick((value) => value + 1);
        if (job?.status === 'concluido' || job?.status === 'erro') {
          try {
            window.opener?.focus();
          } catch {}
        }
      });
    }, 2000);

    return () => window.clearInterval(timer);
  }, [id]);

  const enviarAcaoAssistida = async (action: Record<string, unknown>) => {
    if (!assistido?.id) return;

    try {
      const res = await fetch(`/api/assistido/${assistido.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      const data = await res.json();
      if (!data.sucesso || !data.job) {
        setErro(data.erro || 'Falha ao executar acao assistida.');
        return;
      }

      setAssistido(data.job);
      setAssistidoFrameTick((value) => value + 1);
      notificarOpener('assistido:atualizar', data.job.id);
    } catch {
      setErro('Nao foi possivel enviar a acao para a sessao assistida.');
    }
  };

  const finalizarAssistido = async () => {
    if (!assistido?.id) return;

    try {
      const res = await fetch(`/api/assistido/${assistido.id}/finalizar`, { method: 'POST' });
      const data = await res.json();
      if (!data.sucesso || !data.job) {
        setErro(data.erro || 'Nao foi possivel finalizar a consulta assistida.');
        return;
      }

      setAssistido(data.job);
      if (data.job.status === 'erro') {
        setErro(data.job.erro || data.job.result?.erro || 'Consulta assistida falhou.');
        notificarOpener('assistido:atualizar', data.job.id);
      }
      if (data.job.status === 'concluido') {
        try {
          window.opener?.focus();
        } catch {}
        notificarOpener('assistido:atualizar', data.job.id);
        window.setTimeout(() => fecharPopup(), 1200);
      }
    } catch {
      setErro('Nao foi possivel finalizar a consulta assistida.');
    }
  };

  const handleAssistidoFrameClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!assistido) return;

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = Math.max(0, Math.round(((event.clientX - rect.left) / rect.width) * assistido.viewport.width));
    const y = Math.max(0, Math.round(((event.clientY - rect.top) / rect.height) * assistido.viewport.height));

    void enviarAcaoAssistida({ tipo: 'click', x, y });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.15),transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] text-white">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:py-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Sessao remota
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </div>
              <h1 className="mt-3 text-xl sm:text-2xl font-bold tracking-tight">Consulta assistida</h1>
              <p className="mt-1 text-sm text-slate-300">Resolva o captcha nesta janela e conclua a consulta na mesma sessao.</p>
            </div>
            <div className="flex items-center gap-2 self-start">
              <button
                onClick={fecharPopup}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</p>
              <p className="mt-1 text-sm font-semibold text-white">{assistido?.status || 'carregando'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Viewport</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {assistido ? `${assistido.viewport.width} x ${assistido.viewport.height}` : '-'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Chave</p>
              <p className="mt-1 truncate font-mono text-xs text-white/90">{assistido?.chaveAcesso || id}</p>
            </div>
          </div>
        </div>

        {(erro || assistido?.mensagem) && (
          <div className="mt-4 space-y-2">
            {erro && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {erro}
              </div>
            )}
            {assistido?.mensagem && !erro && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {assistido.mensagem}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
          <div className="rounded-3xl border border-white/10 bg-white p-4 text-slate-900 shadow-2xl shadow-black/20">
            {assistido?.status === 'concluido' || assistido?.status === 'erro' ? (
              <div className="space-y-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    Sessao encerrada
                  </div>
                  <h2 className="mt-3 text-base font-semibold">Consulta finalizada</h2>
                  <p className="text-sm text-slate-600">
                    Volte para a aba principal para baixar o XML e abrir o DANFE.
                  </p>
                </div>

                {assistido?.result?.sucesso && assistido.result.dados && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <a
                      href={`/api/consulta/${assistido.result.dados.tipo}/${assistido.result.dados.chaveAcesso}/xml`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Download XML
                    </a>
                    <a
                      href={`/api/consulta/${assistido.result.dados.tipo}/${assistido.result.dados.chaveAcesso}/xml?format=danfe`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Abrir PDF
                    </a>
                  </div>
                )}

                <button
                  onClick={fecharPopup}
                  className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Fechar e voltar
                </button>
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-200 overflow-hidden bg-slate-50 shadow-lg">
                <div
                  className="relative cursor-crosshair select-none"
                  onClick={handleAssistidoFrameClick}
                  title="Clique na tela para interagir com a sessao"
                >
                  {assistidoFrameUrl ? (
                    <img src={assistidoFrameUrl} alt="Tela da consulta assistida" className="block w-full h-auto" />
                  ) : (
                    <div className="flex h-[480px] items-center justify-center text-sm text-slate-500">
                      Abrindo consulta...
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                  <span>Clique na tela para interagir com a consulta.</span>
                  <span className="font-semibold text-slate-700">Sessao ativa</span>
                </div>
              </div>
            )}

            {assistido?.status !== 'concluido' && assistido?.status !== 'erro' && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button onClick={() => void enviarAcaoAssistida({ tipo: 'press', key: 'Tab' })} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 transition-colors">Tab</button>
                <button onClick={() => void enviarAcaoAssistida({ tipo: 'press', key: 'Enter' })} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 transition-colors">Enter</button>
                <button onClick={() => void enviarAcaoAssistida({ tipo: 'press', key: 'Space' })} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 transition-colors">Espaco</button>
                <button onClick={() => void enviarAcaoAssistida({ tipo: 'press', key: 'Escape' })} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 transition-colors">Esc</button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Sessao</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-400">ID</dt>
                  <dd className="font-mono text-xs text-slate-100 break-all text-right">{assistido?.id || id}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-400">Status</dt>
                  <dd className="font-semibold text-white">{assistido?.status || 'carregando'}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-400">Viewport</dt>
                  <dd className="font-semibold text-white">
                    {assistido ? `${assistido.viewport.width} x ${assistido.viewport.height}` : '-'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Texto</h3>
              <textarea
                value={assistidoTexto}
                onChange={(e) => setAssistidoTexto(e.target.value)}
                rows={4}
                className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Digite texto para enviar para a sessao"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => void enviarAcaoAssistida({ tipo: 'type', text: assistidoTexto, delay: 10 })}
                  disabled={!assistidoTexto.trim()}
                  className="flex-1 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Enviar texto
                </button>
                <button
                  onClick={() => void finalizarAssistido()}
                  className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                >
                  Finalizar
                </button>
              </div>
            </div>

            {assistido?.result?.sucesso && assistido.result.dados && (
              <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-slate-100">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Resultado</h3>
                <div className="mt-3 space-y-2">
                  <div>
                    <span className="text-slate-400">Numero:</span> <span className="font-semibold">{assistido.result.dados.numero}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Serie:</span> <span className="font-semibold">{assistido.result.dados.serie}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Emissao:</span> <span className="font-semibold">{formatarData(assistido.result.dados.dataEmissao)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Emitente:</span> <span className="font-semibold">{assistido.result.dados.razaoSocialEmitente || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">CNPJ:</span> <span className="font-semibold">{formatarCNPJ(assistido.result.dados.cnpjEmitente)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Valor:</span> <span className="font-semibold">{formatarMoeda(assistido.result.dados.valorTotal)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
