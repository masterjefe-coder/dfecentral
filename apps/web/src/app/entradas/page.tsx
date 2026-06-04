import { ReportsPanel } from '../../components/reports-panel';
import { AppShell } from '../../components/app-shell';

export default function EntradasPage() {
  return (
    <AppShell active="/entradas" title="Entradas" description="Visão focada em documentos recebidos, com filtros, gráfico e exportação.">
        <ReportsPanel
          mode="relatorios"
          defaultMovimento="recebidas"
          title="Documentos recebidos"
          description="Visão focada em entradas com filtros, gráfico e exportação."
        />
    </AppShell>
  );
}
