import { StaticPage } from '../../components/static-page';

export default function TermosPage() {
  return (
    <StaticPage kicker="Legal" title="Termos de uso" description="Condições de utilização da plataforma e responsabilidades do usuário.">
      <div className="space-y-4 text-slate-300 leading-7">
        <p>O usuário é responsável pelo uso adequado das credenciais e pelos dados consultados via plataforma.</p>
        <p>As integrações fiscais dependem de disponibilidade dos serviços públicos, certificados e limites contratados.</p>
      </div>
    </StaticPage>
  );
}
