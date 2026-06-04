import { SubscriptionPanel } from '../../components/subscription-panel';
import { AppShell } from '../../components/app-shell';

export default function AssinaturaPage() {
  return (
    <AppShell active="/assinatura" title="Assinatura" description="Gerencie plano, cobrança e renovação." >
      <SubscriptionPanel />
    </AppShell>
  );
}
