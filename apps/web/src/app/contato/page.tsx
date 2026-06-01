import { StaticPage } from '../../components/static-page';

export default function ContatoPage() {
  return (
    <StaticPage kicker="Contato" title="Fale com a equipe" description="Suporte comercial, integração e dúvidas técnicas em um único canal.">
      <div className="grid gap-4 md:grid-cols-3">
        <Info label="E-mail" value="contato@dfecentral.com.br" />
        <Info label="WhatsApp" value="+55 (11) 99999-0000" />
        <Info label="Atendimento" value="Segunda a sexta, 9h às 18h" />
      </div>
    </StaticPage>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
