import type { ReactNode } from 'react';
import Link from 'next/link';

export function SectionHeader({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="text-left sm:text-center">
      <span className="section-kicker text-brand-400">{kicker}</span>
      <h2 className="section-title mt-3 text-white sm:text-center">{title}</h2>
      {description ? <p className="section-copy mt-4 max-w-2xl text-slate-300 sm:mx-auto sm:text-center">{description}</p> : null}
    </div>
  );
}

export function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`surface-card ${className}`.trim()}>{children}</div>;
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'cyan' | 'emerald' | 'amber' | 'red' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    cyan: 'bg-cyan-500/15 text-cyan-100 border-cyan-200/20',
    emerald: 'bg-emerald-500/15 text-emerald-100 border-emerald-200/20',
    amber: 'bg-amber-500/15 text-amber-100 border-amber-200/20',
    red: 'bg-red-500/15 text-red-100 border-red-200/20',
  };

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`.trim()}>{children}</span>;
}

export function EmptyState({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href?: string;
  label?: string;
}) {
  return (
    <GlassCard className="rounded-2xl p-5">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      {href && label ? (
        <Link href={href} className="mt-4 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors">
          {label}
        </Link>
      ) : null}
    </GlassCard>
  );
}
