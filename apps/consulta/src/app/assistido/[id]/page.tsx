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
  frameBox?: { x: number; y: number; width: number; height: number };
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

    const relX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const relY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const box = assistido.frameBox;
    const x = box ? Math.max(0, Math.round(box.x + relX * box.width)) : Math.max(0, Math.round(relX * assistido.viewport.width));
    const y = box ? Math.max(0, Math.round(box.y + relY * box.height)) : Math.max(0, Math.round(relY * assistido.viewport.height));

    void enviarAcaoAssistida({ tipo: 'click', x, y });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.15),transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] text-white">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:py-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Captcha da consulta</h1>
              <p className="mt-1 text-sm text-slate-300">Resolva o captcha diretamente na imagem abaixo.</p>
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

          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
            {assistido?.status || 'carregando'}
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

        <div className="mt-4 grid gap-5">
          <div className="rounded-3xl border border-white/10 bg-white p-4 text-slate-900 shadow-2xl shadow-black/20">
            <div
              className="relative cursor-pointer select-none overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
              onClick={handleAssistidoFrameClick}
              title="Clique na imagem para interagir com o captcha"
            >
              {assistidoFrameUrl ? (
                <img src={assistidoFrameUrl} alt="Captcha da consulta assistida" className="block w-full h-auto" />
              ) : (
                <div className="flex h-[620px] items-center justify-center text-sm text-slate-500">
                  Abrindo captcha...
                </div>
              )}
            </div>

            {assistido?.status === 'concluido' && assistido?.result?.sucesso && assistido.result.dados && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
          </div>
        </div>
      </div>
    </div>
  );
}
