import type { ReactNode } from 'react';
import Link from 'next/link';

export function StaticPage({
  kicker,
  title,
  description,
  children,
  backHref = '/',
}: {
  kicker: string;
  title: string;
  description: string;
  children: ReactNode;
  backHref?: string;
}) {
  return (
    <main className="min-h-screen app-shell bg-slate-950 px-4 py-6 text-white sm:py-8">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_28%)]" />
      <div className="relative mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 rounded-[1.75rem] border border-white/10 bg-white/5 px-4 py-4 backdrop-blur sm:mb-8 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo-light.png" alt="DFeCentral" className="h-8 w-auto brightness-0 invert" />
            <span className="hidden text-xs font-semibold uppercase tracking-[0.24em] text-slate-400 sm:inline">Central fiscal</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <Link href={backHref} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
              Voltar
            </Link>
            <Link href="/auth/entrar" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-100">
              Entrar
            </Link>
          </div>
        </div>
        <section className="surface-card rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur shadow-2xl shadow-black/20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">{kicker}</p>
          <h1 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight">{title}</h1>
          <p className="mt-4 max-w-3xl text-base sm:text-lg leading-7 text-slate-300">{description}</p>
          <div className="mt-8">{children}</div>
        </section>
      </div>
    </main>
  );
}
