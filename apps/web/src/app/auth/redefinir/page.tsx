import { AuthPanel } from '../../../components/auth-panel';

export default async function RedefinirPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return (
    <main className="min-h-screen app-shell flex items-center justify-center bg-slate-950 px-4 py-8 text-white">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.12),transparent_28%)]" />
      <AuthPanel mode="reset" token={params.token} />
    </main>
  );
}
