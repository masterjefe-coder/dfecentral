import { AuthPanel } from '../../../components/auth-panel';

export default async function EntrarPage({ searchParams }: { searchParams?: Promise<{ redirect?: string; erro?: string }> }) {
  const params = await searchParams;
  const initialError = params?.erro === 'google_indisponivel'
    ? 'O login com Google ainda não está configurado na VM.'
    : params?.erro === 'google_invalido'
      ? 'Resposta do Google inválida. Tente novamente.'
      : params?.erro || '';
  return (
    <main className="min-h-screen app-shell flex items-center justify-center bg-slate-50 px-4 py-8 text-slate-900">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_28%)]" />
      <AuthPanel mode="login" redirectTo={params?.redirect} initialError={initialError} />
    </main>
  );
}
