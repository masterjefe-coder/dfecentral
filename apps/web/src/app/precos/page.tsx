import Link from 'next/link';
import { StaticPage } from '../../components/static-page';

const planos = [
  ['Grátis', '50 consultas/mês', '/auth/cadastrar'],
  ['Pro', 'Consultas e API ampliadas', '/auth/cadastrar'],
  ['Enterprise', 'Multi-CNPJ e suporte prioritário', '/contato'],
];

export default function PrecosPage() {
  return (
    <StaticPage kicker="Planos" title="Preços simples" description="Escolha um plano que acompanhe o volume fiscal da sua operação.">
      <div className="grid gap-4 md:grid-cols-3">
        {planos.map(([nome, texto, href]) => (
          <div key={nome} className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">{nome}</p>
            <p className="mt-2 text-lg font-semibold text-white">{texto}</p>
            <Link href={href} className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-100">
              Escolher
            </Link>
          </div>
        ))}
      </div>
    </StaticPage>
  );
}
