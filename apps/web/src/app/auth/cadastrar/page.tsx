import { AuthPanel } from '../../../components/auth-panel';

export default async function CadastrarPage({ searchParams }: { searchParams?: Promise<{ redirect?: string; erro?: string }> }) {
  const params = await searchParams;
  const initialError = params?.erro === 'google_indisponivel'
    ? 'O login com Google ainda não está configurado na VM.'
    : params?.erro || '';
  return (
    <main className="min-h-screen app-shell flex items-center justify-center bg-slate-950 px-4 py-8 text-white">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.14),transparent_28%)]" />
      <AuthPanel mode="register" redirectTo={params?.redirect} initialError={initialError} />
    </main>
  );
}
