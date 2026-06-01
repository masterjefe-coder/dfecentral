import Link from 'next/link';
import { ReportsPanel } from '../../components/reports-panel';

export default function EntradasPage() {
  return (
    <main className="min-h-screen app-shell bg-slate-950 px-4 py-10 text-white">
      <div className="relative mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm font-semibold text-slate-300 hover:text-white">Voltar</Link>
          <Link href="/saidas" className="text-sm font-semibold text-slate-300 hover:text-white">Saídas</Link>
        </div>
        <ReportsPanel
          mode="relatorios"
          defaultMovimento="recebidas"
          title="Documentos recebidos"
          description="Visão focada em entradas com filtros, gráfico e exportação."
        />
      </div>
    </main>
  );
}
