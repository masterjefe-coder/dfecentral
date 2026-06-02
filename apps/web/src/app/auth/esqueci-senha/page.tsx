import { AuthPanel } from '../../../components/auth-panel';

export default function EsqueciSenhaPage() {
  return (
    <main className="min-h-screen app-shell flex items-center justify-center bg-slate-950 px-4 py-8 text-white">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_28%)]" />
      <AuthPanel mode="forgot" />
    </main>
  );
}
