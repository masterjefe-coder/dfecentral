import { AcceptInvitePanel } from '../../../components/accept-invite-panel';

export default async function AceitarConvitePage({ searchParams }: { searchParams?: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return (
    <main className="min-h-screen app-shell flex items-center justify-center bg-slate-950 px-4 py-8 text-white">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.14),transparent_28%)]" />
      <AcceptInvitePanel token={params?.token || ''} />
    </main>
  );
}
