import { StaticPage } from '../../components/static-page';

export default function FaqPage() {
  return (
    <StaticPage kicker="FAQ" title="Perguntas frequentes" description="Respostas rápidas sobre consulta, autenticação e planos.">
      <div className="space-y-4">
        {[
          ['Como acesso o dashboard?', 'Entre em /auth/entrar ou crie sua conta em /auth/cadastrar.'],
          ['Como assino um plano?', 'Abra /precos, escolha Starter, Pro ou Enterprise e conclua o pagamento na InfinitePay.'],
          ['A consulta NFS-e é oficial?', 'Sim. A integração oficial usa certificado digital e fallback assistido quando necessário.'],
          ['Posso usar várias empresas?', 'A base atual já guarda CNPJ e conta por usuário, pronta para expansão.'],
        ].map(([q, a]) => (
          <div key={q} className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="font-semibold text-white">{q}</p>
            <p className="mt-2 text-slate-300">{a}</p>
          </div>
        ))}
      </div>
    </StaticPage>
  );
}
