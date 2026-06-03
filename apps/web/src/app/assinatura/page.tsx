import { SubscriptionPanel } from '../../components/subscription-panel';

export default function AssinaturaPage() {
  return (
    <main className="min-h-screen app-shell bg-slate-50 px-4 py-10 text-slate-900">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.10),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_28%)]" />
      <SubscriptionPanel />
    </main>
  );
}
