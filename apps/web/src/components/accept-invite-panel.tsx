'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function AcceptInvitePanel({ token }: { token: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMensagem('Token de convite ausente.');
      return;
    }

    void (async () => {
      setStatus('loading');
      try {
        const res = await fetch('/api/equipe/aceitar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!data.sucesso) {
          setStatus('error');
          setMensagem(data.erro || 'Nao foi possivel aceitar o convite.');
          return;
        }
        setStatus('done');
        setMensagem('Convite aceito. Seu acesso foi liberado.');
      } catch {
        setStatus('error');
        setMensagem('Nao foi possivel aceitar o convite.');
      }
    })();
  }, [token]);

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-white shadow-2xl shadow-black/20 backdrop-blur sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Acesso à empresa</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Aceitar convite</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">{status === 'loading' ? 'Validando convite...' : mensagem}</p>
        {status === 'error' ? (
          <Link href="/auth/entrar" className="mt-6 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950">
            Entrar
          </Link>
        ) : (
          <Link href="/dashboard" className="mt-6 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950">
            Ir ao dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
