import { StaticPage } from '../../components/static-page';
import { CheckoutAddonButton, CheckoutButton } from '../../components/checkout-button';

const planos = [
  { nome: 'Free', preco: 'R$ 0,00/mês', texto: '10 consultas/mês, consulta por chave e sem XML incluso', plano: 'starter' as const },
  { nome: 'Starter', preco: 'R$ 49,90/mês', texto: '100 consultas/mês, 2 GB de XML incluso e certificado digital', plano: 'starter' as const },
  { nome: 'Pro', preco: 'R$ 119,90/mês', texto: '500 consultas/mês, 10 GB de XML incluso, API REST, webhooks e certificado digital', plano: 'pro' as const },
  { nome: 'Enterprise', preco: 'R$ 199,90/mês', texto: 'Ilimitado, 30 GB de XML incluso, multi-CNPJ, suporte prioritário e certificado digital', plano: 'enterprise' as const },
];

const arquivamento = [
  {
    codigo: 'starter' as const,
    nome: 'XML Lite',
    preco: 'R$ 19,90/mês',
    texto: 'Amplia a cota total para 10 GB de XML arquivado.',
  },
  {
    codigo: 'pro' as const,
    nome: 'XML Plus',
    preco: 'R$ 39,90/mês',
    texto: 'Amplia a cota total para 50 GB de XML arquivado, com ZIP mensal e entradas opcionais.',
  },
  {
    nome: 'Enterprise',
    preco: 'Sob consulta',
    texto: 'Cota ampliada, retenção sob medida e política de uso ajustada à operação.',
  },
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

      <div className="grid gap-4 md:grid-cols-4">
        {planos.map((plano) => (
          <div
            key={plano.nome}
            className={`rounded-3xl border p-5 shadow-2xl transition-all ${
              plano.nome === 'Pro'
                ? 'border-cyan-400/30 bg-gradient-to-b from-white/10 to-white/5 shadow-cyan-500/10 ring-1 ring-cyan-400/15'
                : plano.nome === 'Free'
                  ? 'border-emerald-400/20 bg-emerald-500/5'
                  : 'border-white/10 bg-white/5'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">{plano.nome}</p>
              {plano.nome === 'Pro' ? (
                <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  Mais escolhido
                </span>
              ) : plano.nome === 'Free' ? (
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  Plano grátis
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{plano.preco}</p>
            <p className="mt-2 text-lg font-semibold text-white">{plano.texto}</p>
            <p className="mt-3 text-xs leading-5 text-slate-400">Checkout direto no site. Sem cadastro extra, sem desvio de fluxo.</p>
            {plano.nome === 'Free' ? (
              <a href="/dashboard" className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20">
                Acessar Free
              </a>
            ) : (
              <CheckoutButton
                plano={plano.plano}
                label={plano.nome === 'Enterprise' ? 'Assinar Enterprise' : `Assinar ${plano.nome}`}
                autoStart={planoAtivo === plano.plano}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-[2rem] border border-cyan-400/20 bg-cyan-500/5 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">Add-ons</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Armazenamento em nuvem de XML em R2</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Opcional para guardar XMLs automaticamente em nuvem, com retenção, download mensal em ZIP e inclusão de XMLs de entrada quando habilitado.
            </p>
          </div>
          <p className="text-sm text-cyan-100/90">Cobrança separada por volume e retenção</p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            'Starter: 2 GB incluídos',
            'Pro: 10 GB incluídos',
            'Enterprise: 30 GB incluídos',
            'Ideal para quem precisa guardar XML por prazo fiscal na nuvem',
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Precificação dos add-ons</p>
        <h2 className="mt-2 text-2xl font-bold text-white">Armazenamento em nuvem de XML</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">Você pode comprar mais espaço na nuvem quando passar da cota incluída no plano.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {arquivamento.map((item) => (
            <div key={item.nome} className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">{item.nome}</p>
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white">R2</span>
              </div>
              <p className="mt-3 text-2xl font-bold text-white">{item.preco}</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">{item.texto}</p>
              {item.codigo ? <CheckoutAddonButton arquivamento={item.codigo} label={`Ativar ${item.nome}`} /> : null}
            </div>
          ))}
        </div>
      </div>
    </StaticPage>
  );
}
