import Link from 'next/link';

const documentos = [
  {
    sigla: 'NF-e',
    nome: 'Nota Fiscal Eletrônica',
    descricao: 'Modelo 55 — Operações de venda de mercadorias entre empresas.',
    icon: '📄',
  },
  {
    sigla: 'NFC-e',
    nome: 'Nota Fiscal de Consumidor',
    descricao: 'Modelo 65 — Vendas ao consumidor final, substitui o cupom fiscal.',
    icon: '🛒',
  },
  {
    sigla: 'NFS-e',
    nome: 'Nota Fiscal de Serviço',
    descricao: 'Emissão de notas para prestação de serviços municipality.',
    icon: '💼',
  },
  {
    sigla: 'CT-e',
    nome: 'Conhecimento de Transporte',
    descricao: 'Modelo 57 — Documento de transporte de cargas.',
    icon: '🚛',
  },
  {
    sigla: 'MDF-e',
    nome: 'Manifesto de Documentos',
    descricao: 'Modelo 58 — Manifesto eletrônico de documentos fiscais.',
    icon: '📋',
  },
  {
    sigla: 'DC-e',
    nome: 'Declaração de Conteúdo',
    descricao: 'Declaração eletrônica de conteúdo desde abril/2026.',
    icon: '📦',
  },
];

const funcionalidades = [
  {
    titulo: 'Consulta por Chave',
    descricao: 'Acesse qualquer documento fiscal com apenas a chave de acesso de 44 dígitos.',
    icon: '🔍',
  },
  {
    titulo: 'Consulta por CNPJ',
    descricao: 'Visualize todas as notas emitidas e recebidas por um CNPJ específico.',
    icon: '🏢',
  },
  {
    titulo: 'Download de XML',
    descricao: 'Baixe o XML autorizado de qualquer documento fiscal consultado.',
    icon: '⬇️',
  },
  {
    titulo: 'Visualizar DANFE',
    descricao: 'Visualize e imprima o DANFE, DACTE ou DAMDFE em PDF.',
    icon: '🖨️',
  },
  {
    titulo: 'API REST',
    descricao: 'Integre a consulta de documentos no seu sistema via API.',
    icon: '⚡',
  },
  {
    titulo: 'Multi-Documento',
    descricao: 'NF-e, NFC-e, NFS-e, CT-e, MDF-e e DC-e — tudo em um lugar.',
    icon: '🗂️',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src="/logo-dark.png" alt="DFeCentral" className="h-9 w-auto" />
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#documentos" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
              Documentos
            </Link>
            <Link href="#funcionalidades" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
              Funcionalidades
            </Link>
            <Link href="#precos" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
              Preços
            </Link>
            <Link href="https://consulta.dfecentral.com.br" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
              Consulta
            </Link>
            <Link href="/documentacao" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
              API Docs
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/entrar"
              className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/auth/cadastrar"
              className="px-4 py-2 text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 transition-opacity"
            >
              Criar Conta
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-24 md:py-32 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950" />
        <div className="absolute inset-0 opacity-30 dark:opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 25% 25%, var(--primary) 0%, transparent 50%), radial-gradient(circle at 75% 75%, var(--primary) 0%, transparent 50%)',
        }} />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Plataforma fiscal completa
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight tracking-tight">
            Central de Documentos
            <br />
            <span className="text-[var(--primary)]">Fiscais do Brasil</span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--muted-foreground)] mb-10 max-w-2xl mx-auto leading-relaxed">
            Consulte, baixe e gerencie NF-e, NFC-e, NFS-e, CT-e, MDF-e e DC-e.
            Uma plataforma para todos os documentos fiscais eletrônicos do Brasil.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/cadastrar"
              className="px-8 py-3.5 text-lg font-medium bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl hover:opacity-90 transition-all shadow-lg shadow-[var(--primary)]/25"
            >
              Criar Conta Grátis
            </Link>
            <Link
              href="https://consulta.dfecentral.com.br"
              className="px-8 py-3.5 text-lg font-medium border-2 border-[var(--border)] rounded-xl hover:bg-[var(--secondary)] transition-colors"
            >
              Consultar Documento
            </Link>
          </div>
        </div>
      </section>

      {/* Documentos */}
      <section id="documentos" className="py-16 px-4 bg-[var(--secondary)]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Documentos Suportados</h2>
          <p className="text-center text-[var(--muted-foreground)] mb-12 max-w-2xl mx-auto">
            Todos os tipos de documentos fiscais eletrônicos brasileiros em uma única plataforma.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documentos.map((doc) => (
              <div
                key={doc.sigla}
                className="bg-[var(--background)] p-6 rounded-xl border border-[var(--border)] hover:shadow-lg transition-shadow"
              >
                <div className="text-3xl mb-3">{doc.icon}</div>
                <h3 className="text-xl font-bold mb-1">{doc.sigla}</h3>
                <p className="text-sm font-medium text-[var(--primary)] mb-2">{doc.nome}</p>
                <p className="text-sm text-[var(--muted-foreground)]">{doc.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Funcionalidades</h2>
          <p className="text-center text-[var(--muted-foreground)] mb-12 max-w-2xl mx-auto">
            Tudo que você precisa para consultar e gerenciar documentos fiscais.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {funcionalidades.map((func) => (
              <div key={func.titulo} className="text-center">
                <div className="text-4xl mb-4">{func.icon}</div>
                <h3 className="text-lg font-bold mb-2">{func.titulo}</h3>
                <p className="text-sm text-[var(--muted-foreground)]">{func.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API Section */}
      <section className="py-16 px-4 bg-[var(--secondary)]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">API para Desenvolvedores</h2>
          <p className="text-[var(--muted-foreground)] mb-8 max-w-2xl mx-auto">
            Integre a consulta de documentos fiscais no seu sistema com nossa REST API.
            Documentação completa com exemplos em várias linguagens.
          </p>
          <div className="bg-[var(--background)] rounded-xl border border-[var(--border)] p-6 text-left font-mono text-sm overflow-x-auto">
            <pre>{`GET /api/v1/nfe/{chave_acesso}
Authorization: Bearer sua_api_key

{
  "sucesso": true,
  "dados": {
    "chaveAcesso": "3524031234567800019555001000000123...",
    "tipo": "nfe",
    "status": "autorizada",
    "valorTotal": 1500.00,
    "dataEmissao": "2026-03-15T10:30:00Z"
  }
}`}</pre>
          </div>
          <Link
            href="/documentacao"
            className="inline-block mt-6 px-6 py-3 font-medium bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 transition-opacity"
          >
            Ver Documentação Completa
          </Link>
        </div>
      </section>

      {/* Preços */}
      <section id="precos" className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Preços Simples e-transparentes</h2>
          <p className="text-[var(--muted-foreground)] mb-12">
            Consultas ilimitadas a partir de R$ 0/mês.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="bg-[var(--background)] p-6 rounded-xl border border-[var(--border)]">
              <h3 className="text-lg font-bold mb-2">Grátis</h3>
              <div className="text-3xl font-bold mb-4">R$ 0</div>
              <ul className="text-sm text-left space-y-2 mb-6">
                <li>✅ 50 consultas/mês</li>
                <li>✅ NF-e, NFC-e, NFS-e</li>
                <li>✅ Download XML</li>
                <li>✅ Consulta por chave</li>
                <li>❌ API REST</li>
                <li>❌ CT-e, MDF-e, DC-e</li>
              </ul>
              <Link
                href="/auth/cadastrar"
                className="block w-full py-2 text-center font-medium border border-[var(--border)] rounded-lg hover:bg-[var(--secondary)] transition-colors"
              >
                Começar Grátis
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-[var(--background)] p-6 rounded-xl border-2 border-[var(--primary)] relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-bold px-3 py-1 rounded-full">
                MAIS POPULAR
              </div>
              <h3 className="text-lg font-bold mb-2">Pro</h3>
              <div className="text-3xl font-bold mb-4">
                R$ 49<span className="text-base font-normal">/mês</span>
              </div>
              <ul className="text-sm text-left space-y-2 mb-6">
                <li>✅ Consultas ilimitadas</li>
                <li>✅ Todos os documentos</li>
                <li>✅ Download XML + DANFE</li>
                <li>✅ API REST (10K req/mês)</li>
                <li>✅ Webhooks</li>
                <li>✅ Suporte por email</li>
              </ul>
              <Link
                href="/auth/cadastrar"
                className="block w-full py-2 text-center font-medium bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 transition-opacity"
              >
                Assinar Pro
              </Link>
            </div>

            {/* Enterprise */}
            <div className="bg-[var(--background)] p-6 rounded-xl border border-[var(--border)]">
              <h3 className="text-lg font-bold mb-2">Enterprise</h3>
              <div className="text-3xl font-bold mb-4">
                R$ 199<span className="text-base font-normal">/mês</span>
              </div>
              <ul className="text-sm text-left space-y-2 mb-6">
                <li>✅ Tudo do Pro</li>
                <li>✅ API ilimitada</li>
                <li>✅ Multi-CNPJ</li>
                <li>✅ Webhooks avançados</li>
                <li>✅ Suporte prioritário</li>
                <li>✅ SLA 99.9%</li>
              </ul>
              <Link
                href="/auth/cadastrar"
                className="block w-full py-2 text-center font-medium border border-[var(--border)] rounded-lg hover:bg-[var(--secondary)] transition-colors"
              >
                Falar com Vendas
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-[var(--border)]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <img src="/logo-dark.png" alt="DFeCentral" className="h-8 w-auto mb-4" />
              <p className="text-sm text-[var(--muted-foreground)]">
                A central de documentos fiscais do Brasil.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-3">Produto</h4>
              <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
                <li><Link href="#documentos" className="hover:text-[var(--foreground)]">Documentos</Link></li>
                <li><Link href="#precos" className="hover:text-[var(--foreground)]">Preços</Link></li>
                <li><Link href="/documentacao" className="hover:text-[var(--foreground)]">API Docs</Link></li>
                <li><Link href="/auth/entrar" className="hover:text-[var(--foreground)]">Login</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-3">Documentos</h4>
              <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
                <li><Link href="/documentos/nfe" className="hover:text-[var(--foreground)]">NF-e</Link></li>
                <li><Link href="/documentos/nfce" className="hover:text-[var(--foreground)]">NFC-e</Link></li>
                <li><Link href="/documentos/nfse" className="hover:text-[var(--foreground)]">NFS-e</Link></li>
                <li><Link href="/documentos/cte" className="hover:text-[var(--foreground)]">CT-e</Link></li>
                <li><Link href="/documentos/mdfe" className="hover:text-[var(--foreground)]">MDF-e</Link></li>
                <li><Link href="/documentos/dce" className="hover:text-[var(--foreground)]">DC-e</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-3">Empresa</h4>
              <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
                <li><Link href="/sobre" className="hover:text-[var(--foreground)]">Sobre</Link></li>
                <li><Link href="/contato" className="hover:text-[var(--foreground)]">Contato</Link></li>
                <li><Link href="/privacidade" className="hover:text-[var(--foreground)]">Privacidade</Link></li>
                <li><Link href="/termos" className="hover:text-[var(--foreground)]">Termos</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-[var(--border)] text-center text-sm text-[var(--muted-foreground)]">
            © 2026 DFeCentral. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
