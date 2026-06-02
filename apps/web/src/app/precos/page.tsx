import { StaticPage } from '../../components/static-page';
import { CheckoutButton } from '../../components/checkout-button';

const planos = [
  { nome: 'Starter', preco: 'R$ 49,90/mês', texto: '50 consultas/mês, XML e consulta por chave', plano: 'starter' as const },
  { nome: 'Pro', preco: 'R$ 119,90/mês', texto: '500 consultas/mês, API REST e webhooks', plano: 'pro' as const },
  { nome: 'Enterprise', preco: 'R$ 199,90/mês', texto: 'Ilimitado, multi-CNPJ e suporte prioritário', plano: 'enterprise' as const },
];

export default async function PrecosPage({ searchParams }: { searchParams?: Promise<{ plano?: string }> }) {
  const params = await searchParams;
  const planoAtivo = params?.plano;

  return (
    <StaticPage kicker="Planos" title="Preços simples" description="Escolha um plano que acompanhe o volume fiscal da sua operação.">
      {planoAtivo ? (
        <div className="mb-5 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          Plano selecionado: <span className="font-semibold uppercase">{planoAtivo}</span>. Se precisar, o checkout abre sozinho após o login.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {planos.map((plano) => (
          <div
            key={plano.nome}
            className={`rounded-3xl border p-5 shadow-2xl transition-all ${
              plano.nome === 'Pro'
                ? 'border-cyan-400/30 bg-gradient-to-b from-white/10 to-white/5 shadow-cyan-500/10 ring-1 ring-cyan-400/15'
                : 'border-white/10 bg-white/5'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">{plano.nome}</p>
              {plano.nome === 'Pro' ? (
                <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  Mais escolhido
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{plano.preco}</p>
            <p className="mt-2 text-lg font-semibold text-white">{plano.texto}</p>
            <p className="mt-3 text-xs leading-5 text-slate-400">Checkout direto no site. Sem cadastro extra, sem desvio de fluxo.</p>
            <CheckoutButton
              plano={plano.plano}
              label={plano.nome === 'Enterprise' ? 'Assinar Enterprise' : `Assinar ${plano.nome}`}
              autoStart={planoAtivo === plano.plano}
            />
          </div>
        ))}
      </div>
    </StaticPage>
  );
}
