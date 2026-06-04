import Link from 'next/link';
import { AppShell } from '../../components/app-shell';

const itens = [
  { titulo: 'Empresa', descricao: 'Nome, CNPJ, empresa ativa, certificado e integrações.', href: '/empresa' },
  { titulo: 'Relatórios', descricao: 'Preferências de movimento, tipo e exportação.', href: '/relatorios' },
  { titulo: 'Entradas', descricao: 'Acesso direto para documentos recebidos.', href: '/entradas' },
  { titulo: 'Saídas', descricao: 'Acesso direto para documentos emitidos.', href: '/saidas' },
];

export default function ConfiguracoesPage() {
  return (
    <AppShell active="/configuracoes" title="Configurações" description="Ajustes operacionais e atalhos para administrar a conta com rapidez.">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Preferências</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Organize a operação</h2>
          <p className="mt-2 text-sm text-slate-600">A maior parte da configuração fica concentrada na página da empresa. Aqui estão os atalhos para os pontos mais usados.</p>
          <div className="mt-5 grid gap-3">
            {itens.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-white">
                <p className="font-semibold text-slate-950">{item.titulo}</p>
                <p className="mt-1 text-sm text-slate-600">{item.descricao}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-cyan-200 bg-cyan-50 p-6 shadow-xl shadow-cyan-950/5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700">Dicas</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Deixe a conta redonda</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            <li>• Cadastre o CNPJ principal e valide antes de salvar.</li>
            <li>• Envie o certificado na aba Empresa para consultas oficiais.</li>
            <li>• Use Entradas e Saídas para acesso rápido aos fluxos de trabalho.</li>
            <li>• Ajuste o relatório padrão antes de exportar PDF, CSV ou Excel.</li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
