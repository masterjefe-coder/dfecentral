import { ReportsPanel } from '../../components/reports-panel';
import { AppShell } from '../../components/app-shell';

export default function ExportarPage() {
  return (
    <AppShell active="/exportar" title="Exportar" description="Gere arquivos estruturados para BI, contabilidade e análises internas.">
        <ReportsPanel mode="exportar" title="Exportação completa" description="Gere arquivos estruturados para BI, contabilidade e análises internas." />
    </AppShell>
  );
}
