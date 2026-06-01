import Link from 'next/link';
import { ReportsPanel } from '../../components/reports-panel';

export default function SaidasPage() {
  return (
    <main className="min-h-screen app-shell bg-slate-950 px-4 py-10 text-white">
      <div className="relative mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm font-semibold text-slate-300 hover:text-white">Voltar</Link>
          <Link href="/entradas" className="text-sm font-semibold text-slate-300 hover:text-white">Entradas</Link>
        </div>
        <ReportsPanel
          mode="relatorios"
          defaultMovimento="emitidas"
          title="Documentos emitidos"
          description="Visão focada em saídas com filtros, gráfico e exportação."
        />
      </div>
    </main>
  );
}
