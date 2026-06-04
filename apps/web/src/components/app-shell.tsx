'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

type MenuItem = {
  href: string;
  label: string;
  hint?: string;
};

type AppShellProps = {
  active: string;
  title: string;
  description?: string;
  children: ReactNode;
};

const MENU: MenuItem[] = [
  { href: '/dashboard', label: 'Dashboard', hint: 'Entradas e saídas' },
  { href: '/entradas', label: 'Entradas', hint: 'Compras e recebidas' },
  { href: '/saidas', label: 'Saídas', hint: 'Emitidas e exportação' },
  { href: '/relatorios', label: 'Relatórios', hint: 'Gráficos e exportação' },
  { href: '/empresa', label: 'Empresa', hint: 'Dados e certificados' },
  { href: '/configuracoes', label: 'Configurações', hint: 'Preferências e integrações' },
  { href: '/api-central', label: 'API', hint: 'Chaves e documentação' },
  { href: '/exportar', label: 'Exportar', hint: 'CSV, XLSX e PDF' },
];

export function AppShell({ active, title, description, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="grid min-h-screen lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-slate-950/95 p-4 lg:border-b-0 lg:border-r lg:border-white/10 lg:p-5">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-cyan-300">DFeCentral</p>
            <h1 className="mt-2 text-2xl font-bold text-white">Central fiscal</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">Navegação rápida, gestão de empresa, importações e relatórios em um único lugar.</p>
          </div>

          <nav className="mt-5 space-y-2">
            {MENU.map((item) => {
              const activeItem = active === item.href || active.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-2xl border px-4 py-3 transition-colors ${activeItem ? 'border-cyan-400/50 bg-cyan-400/15 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'}`}
                >
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="mt-1 text-xs text-inherit/70">{item.hint}</div>
                </Link>
              );
            })}
          </nav>

          <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">Atalhos</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <Link href="/dashboard?aba=entradas" className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10">Entradas</Link>
              <Link href="/dashboard?aba=saidas" className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10">Saídas</Link>
              <Link href="/empresa#certificados" className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10">Certificados</Link>
            </div>
          </div>
        </aside>

        <main className="bg-slate-50 text-slate-900">
          <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
            <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-5 backdrop-blur shadow-2xl shadow-slate-900/10 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{title}</h2>
                  {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-3 py-2 hover:bg-slate-100">Dashboard</Link>
                  <Link href="/empresa" className="rounded-full border border-slate-200 bg-white px-3 py-2 hover:bg-slate-100">Empresa</Link>
                  <Link href="/api-central" className="rounded-full border border-slate-200 bg-white px-3 py-2 hover:bg-slate-100">API</Link>
                </div>
              </div>
            </div>

            <div className="mt-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
