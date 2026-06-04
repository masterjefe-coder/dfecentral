import { ReportsPanel } from '../../components/reports-panel';
import { AppShell } from '../../components/app-shell';

export default function SaidasPage() {
  return (
    <AppShell active="/saidas" title="Saídas" description="Visão focada em documentos emitidos, com filtros, gráfico e exportação.">
        <ReportsPanel
          mode="relatorios"
          defaultMovimento="emitidas"
          title="Documentos emitidos"
          description="Visão focada em saídas com filtros, gráfico e exportação."
        />
    </AppShell>
  );
}
