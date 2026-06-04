import { ReportsPanel } from '../../components/reports-panel';
import { AppShell } from '../../components/app-shell';

export default function RelatoriosPage() {
  return (
    <AppShell active="/relatorios" title="Relatórios" description="Acompanhe o volume por tipo, por movimento e exporte para PDF, CSV ou Excel.">
        <ReportsPanel mode="relatorios" title="Painel de relatórios" description="Acompanhe o volume por tipo, por movimento e exporte o resultado para PDF, CSV ou Excel." />
    </AppShell>
  );
}
