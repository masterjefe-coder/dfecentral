import Link from 'next/link';
import { ReportsPanel } from '../../components/reports-panel';

export default function ExportarPage() {
  return (
    <main className="min-h-screen app-shell bg-slate-950 px-4 py-10 text-white">
      <div className="relative mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm font-semibold text-slate-300 hover:text-white">Voltar</Link>
          <Link href="/relatorios" className="text-sm font-semibold text-slate-300 hover:text-white">Relatórios</Link>
        </div>
        <ReportsPanel mode="exportar" title="Exportação completa" description="Gere arquivos estruturados para BI, contabilidade e análises internas." />
      </div>
    </main>
  );
}
