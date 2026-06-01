import type { ReactNode } from 'react';
import Link from 'next/link';

type SectionHeaderProps = {
  kicker: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
};

export function SectionHeader({ kicker, title, description, align = 'center' }: SectionHeaderProps) {
  const isCenter = align === 'center';
  return (
    <div className={isCenter ? 'text-center' : 'text-left'}>
      <span className="section-kicker text-brand-600">{kicker}</span>
      <h2 className={`section-title mt-3 ${isCenter ? 'mx-auto' : ''}`}>{title}</h2>
      {description ? <p className={`section-copy mt-4 text-lg ${isCenter ? 'mx-auto max-w-2xl' : ''}`}>{description}</p> : null}
    </div>
  );
}

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  strong?: boolean;
};

export function GlassCard({ children, className = '', strong = false }: GlassCardProps) {
  return <div className={`${strong ? 'surface-card-strong' : 'surface-card'} ${className}`.trim()}>{children}</div>;
}

type MetricCardProps = {
  label: string;
  value: string;
  sub?: string;
};

export function MetricCard({ label, value, sub }: MetricCardProps) {
  return (
    <GlassCard className="rounded-3xl p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {sub ? <p className="mt-1 text-sm text-slate-300">{sub}</p> : null}
    </GlassCard>
  );
}

type CTAProps = {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
};

export function CTA({ href, children, variant = 'primary', className = '' }: CTAProps) {
  const styles = {
    primary: 'text-white bg-slate-900 hover:bg-slate-800 shadow-xl shadow-slate-900/20',
    secondary: 'text-slate-700 bg-white border-2 border-slate-200 hover:border-slate-300',
    ghost: 'text-slate-700 hover:text-slate-900 hover:bg-slate-50',
  }[variant];

  return (
    <Link href={href} className={`inline-flex items-center justify-center rounded-xl px-6 py-3.5 text-base font-semibold transition-all ${styles} ${className}`.trim()}>
      {children}
    </Link>
  );
}
