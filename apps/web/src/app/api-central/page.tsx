import Link from 'next/link';
import { AppShell } from '../../components/app-shell';

const rotas = [
  ['/api/v1/auth/me', 'Perfil e API key'],
  ['/api/v1/auth/prefs', 'Preferências do usuário'],
  ['/api/v1/empresas', 'Empresas vinculadas'],
  ['/api/v1/certificados', 'Certificado digital ativo'],
  ['/api/v1/importacoes/xml', 'Importação manual de XML e ZIP'],
  ['/api/v1/importacoes/:tipo', 'Importação SEFAZ por tipo'],
  ['/api/v1/relatorios/pdf', 'Exportação de relatórios em PDF'],
  ['/api/v1/contabilidade/pacote-mensal', 'Pacote mensal de XMLs'],
];

export default function ApiCentralPage() {
  return (
    <AppShell active="/api-central" title="API" description="Referência rápida para integração com autenticação, importação e relatórios.">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Referência</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Rotas principais</h2>
          <div className="mt-4 grid gap-3">
            {rotas.map(([rota, desc]) => (
              <div key={rota} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-mono text-sm text-cyan-700">{rota}</p>
                <p className="mt-1 text-sm text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-slate-100 shadow-xl shadow-slate-900/20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Autenticação</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Como usar</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li>• A API usa `Authorization: Bearer` ou `x-api-key`.</li>
            <li>• A chave aparece na página da Empresa, na seção da conta.</li>
            <li>• Use o certificado ativo para consultas oficiais e importações.</li>
            <li>• A importação manual de XML/ZIP já salva tudo na base local.</li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
            <Link href="/empresa" className="rounded-full bg-white px-3 py-2 text-slate-950 hover:bg-slate-100">Abrir Empresa</Link>
            <Link href="/documentacao" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-white hover:bg-white/10">Documentação</Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
