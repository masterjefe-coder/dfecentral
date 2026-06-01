import { AuthPanel } from '../../../components/auth-panel';

export default function EntrarPage() {
  return (
    <main className="min-h-screen app-shell bg-slate-950 px-4 py-12 text-white">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.14),transparent_28%)]" />
      <AuthPanel mode="login" />
    </main>
  );
}
