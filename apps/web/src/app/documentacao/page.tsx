import Link from 'next/link';
import { StaticPage } from '../../components/static-page';

export default function DocumentacaoPage() {
  return (
    <StaticPage kicker="API" title="Documentação da plataforma" description="Base para integração com autenticação, conta, auditoria e importação. Rotas estáveis e linguagem direta para começar rápido.">
      <div className="grid gap-4 md:grid-cols-2">
        {[
          ['/api/v1/auth/entrar', 'Login por e-mail e senha'],
          ['/api/v1/auth/registrar', 'Cadastro de usuário'],
          ['/api/v1/auth/me', 'Perfil e chave da conta'],
          ['/api/v1/auth/prefs', 'Preferências do usuário'],
          ['/api/v1/conta', 'Resumo da conta'],
          ['/api/v1/consultas/recentes', 'Auditoria recente'],
        ].map(([rota, desc]) => (
          <div key={rota} className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="font-mono text-sm text-cyan-200">{rota}</p>
            <p className="mt-2 text-slate-300">{desc}</p>
          </div>
        ))}
      </div>
      <Link href="/dashboard" className="mt-6 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-100">
        Abrir dashboard
      </Link>
    </StaticPage>
  );
}
