import Link from 'next/link';
import { ReportsPanel } from '../../components/reports-panel';

export default function RelatoriosPage() {
  return (
    <main className="min-h-screen app-shell bg-slate-50 px-4 py-10 text-slate-900">
      <div className="relative mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm font-semibold text-slate-600 hover:text-slate-950">Voltar</Link>
          <Link href="/empresa" className="text-sm font-semibold text-slate-600 hover:text-slate-950">Empresa</Link>
        </div>
        <ReportsPanel mode="relatorios" title="Painel de relatórios" description="Acompanhe o volume por tipo, por movimento e exporte o resultado para PDF, CSV ou Excel." />
      </div>
    </main>
  );
}
