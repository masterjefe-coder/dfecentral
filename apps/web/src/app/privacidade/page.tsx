import { StaticPage } from '../../components/static-page';

export default function PrivacidadePage() {
  return (
    <StaticPage kicker="Legal" title="Política de privacidade" description="Como os dados fiscais e cadastrais são tratados na plataforma.">
      <div className="space-y-4 text-slate-300 leading-7">
        <p>Coletamos apenas os dados necessários para autenticação, auditoria e operação da conta.</p>
        <p>Consultas e importações podem ser auditadas para fins de segurança, cobrança e suporte.</p>
      </div>
    </StaticPage>
  );
}
