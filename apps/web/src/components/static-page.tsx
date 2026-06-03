import type { ReactNode } from 'react';
import Link from 'next/link';

export function StaticPage({
  kicker,
  title,
  description,
  children,
  backHref = '/',
  tone = 'dark',
}: {
  kicker: string;
  title: string;
  description: string;
  children: ReactNode;
  backHref?: string;
  tone?: 'dark' | 'light';
}) {
  const isLight = tone === 'light';
  return (
    <main className={`min-h-screen app-shell px-4 py-6 sm:py-8 ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-white'}`}>
      <div className={`absolute inset-0 pointer-events-none ${isLight ? 'bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.10),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_28%)]' : 'bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_28%)]'}`} />
      <div className="relative mx-auto max-w-6xl">
        <div className={`mb-6 flex flex-col gap-4 rounded-[1.75rem] border px-4 py-4 backdrop-blur sm:mb-8 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${isLight ? 'border-slate-200 bg-white/90 text-slate-900' : 'border-white/10 bg-white/5 text-white'}`}>
          <Link href="/" className="flex items-center gap-3">
            <img src={isLight ? '/logo-dark.png' : '/logo-light.png'} alt="DFeCentral" className={`h-8 w-auto ${isLight ? '' : 'brightness-0 invert'}`} />
            <span className={`hidden text-xs font-semibold uppercase tracking-[0.24em] sm:inline ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Central fiscal</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <Link href={backHref} className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${isLight ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-950' : 'border-white/10 bg-white/5 text-white hover:bg-white/10'}`}>
              Voltar
            </Link>
            <Link href="/auth/entrar" className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${isLight ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-950 hover:bg-slate-100'}`}>
              Entrar
            </Link>
          </div>
        </div>
        <section className={`surface-card rounded-[2rem] border p-6 sm:p-8 backdrop-blur shadow-2xl ${isLight ? 'border-slate-200 bg-white/90 shadow-slate-900/10' : 'border-white/10 bg-white/5 shadow-black/20'}`}>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${isLight ? 'text-cyan-700' : 'text-cyan-300'}`}>{kicker}</p>
          <h1 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight">{title}</h1>
          <p className={`mt-4 max-w-3xl text-base sm:text-lg leading-7 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{description}</p>
          <div className="mt-8">{children}</div>
        </section>
      </div>
    </main>
  );
}
