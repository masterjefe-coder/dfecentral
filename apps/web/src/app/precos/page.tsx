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

export default async function PrecosPage({ searchParams }: { searchParams?: Promise<{ plano?: string; metodo?: string; arquivamento?: string }> }) {
  const params = await searchParams;
  const planoAtivo = params?.plano;
  const metodoAtivo = params?.metodo === 'pix' ? 'pix' : 'cartao';
  const arquivamentoAtivo = params?.arquivamento;

  return (
    <StaticPage tone="light" kicker="Planos" title="Preços simples" description="Escolha um plano que acompanhe o volume fiscal da sua operação.">
      {planoAtivo ? (
        <div className="mb-5 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
          Plano selecionado: <span className="font-semibold uppercase">{planoAtivo}</span>. Se precisar, o checkout abre sozinho após o login.
        </div>
      ) : null}

      <div className="mb-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Forma de cobrança</p>
            <p className="mt-2 text-sm text-slate-600">Escolha como a assinatura vai ser cobrada daqui para frente.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/precos${planoAtivo ? `?plano=${encodeURIComponent(planoAtivo)}` : ''}${planoAtivo ? '&' : '?'}metodo=cartao`} className={`rounded-full px-4 py-2 text-sm font-semibold ${metodoAtivo === 'cartao' ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}>
              Cartão
            </a>
            <a href={`/precos${planoAtivo ? `?plano=${encodeURIComponent(planoAtivo)}` : ''}${planoAtivo ? '&' : '?'}metodo=pix`} className={`rounded-full px-4 py-2 text-sm font-semibold ${metodoAtivo === 'pix' ? 'bg-cyan-500 text-slate-950' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}>
              PIX
            </a>
          </div>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Assinatura de qualquer plano exige CNPJ ativo. O método de cobrança pode ser alterado depois.
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {planos.map((plano) => (
          <div
            key={plano.nome}
            className={`rounded-3xl border p-5 shadow-2xl transition-all ${
              plano.nome === 'Pro'
                ? 'border-cyan-200 bg-gradient-to-b from-white to-cyan-50/70 shadow-cyan-500/10 ring-1 ring-cyan-200/60'
                : plano.nome === 'Free'
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{plano.nome}</p>
              {plano.nome === 'Pro' ? (
                <span className="rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-800">
                  Mais escolhido
                </span>
              ) : plano.nome === 'Free' ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                  Plano grátis
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-950">{plano.preco}</p>
            <p className="mt-2 text-lg font-semibold text-slate-800">{plano.texto}</p>
            <p className="mt-3 text-xs leading-5 text-slate-500">Checkout direto no site. Sem cadastro extra, sem desvio de fluxo.</p>
            {plano.nome === 'Free' ? (
              <a href="/dashboard" className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100">
                Acessar Free
              </a>
            ) : (
              <CheckoutButton
                plano={plano.plano}
                label={plano.nome === 'Enterprise' ? 'Assinar Enterprise' : `Assinar ${plano.nome}`}
                autoStart={planoAtivo === plano.plano}
                metodoPagamento={metodoAtivo}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-[2rem] border border-cyan-200 bg-cyan-50 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700">Add-ons</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Armazenamento em nuvem de XML em R2</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Opcional para guardar XMLs automaticamente em nuvem, com retenção, download mensal em ZIP e inclusão de XMLs de entrada quando habilitado.
            </p>
          </div>
          <p className="text-sm text-cyan-800">Cobrança separada por volume e retenção</p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            'Starter: 2 GB incluídos',
            'Pro: 10 GB incluídos',
            'Enterprise: 30 GB incluídos',
            'Ideal para quem precisa guardar XML por prazo fiscal na nuvem',
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Precificação dos add-ons</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">Armazenamento em nuvem de XML</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Você pode comprar mais espaço na nuvem quando passar da cota incluída no plano.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {arquivamento.map((item) => (
            <div key={item.nome} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{item.nome}</p>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">R2</span>
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-950">{item.preco}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.texto}</p>
              {item.codigo ? <CheckoutAddonButton arquivamento={item.codigo} label={`Ativar ${item.nome}`} autoStart={arquivamentoAtivo === item.codigo} /> : null}
            </div>
          ))}
        </div>
      </div>
    </StaticPage>
  );
}
