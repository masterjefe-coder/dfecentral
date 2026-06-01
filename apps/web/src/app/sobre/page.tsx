import { StaticPage } from '../../components/static-page';

export default function SobrePage() {
  return (
    <StaticPage kicker="Institucional" title="Sobre a DFeCentral" description="Uma plataforma para consulta, importação e gestão de documentos fiscais com foco em simplicidade e automação.">
      <div className="grid gap-4 md:grid-cols-3">
        {['NF-e, NFC-e, CT-e, MDF-e, NFS-e e DC-e', 'Consulta e importação centralizadas', 'Base pronta para empresas e SaaS'].map((item) => (
          <div key={item} className="rounded-3xl border border-white/10 bg-white/5 p-5 text-slate-200">
            {item}
          </div>
        ))}
      </div>
    </StaticPage>
  );
}
