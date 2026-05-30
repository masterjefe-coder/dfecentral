import Link from 'next/link';

const documentos = [
  {
    sigla: 'NF-e',
    nome: 'Nota Fiscal Eletrônica',
    descricao: 'Modelo 55 — Operações de venda de mercadorias entre empresas.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    sigla: 'NFC-e',
    nome: 'Nota Fiscal de Consumidor',
    descricao: 'Modelo 65 — Vendas ao consumidor final, substitui o cupom fiscal.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    sigla: 'NFS-e',
    nome: 'Nota Fiscal de Serviço',
    descricao: 'Emissão de notas para prestação de serviços municipais.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    sigla: 'CT-e',
    nome: 'Conhecimento de Transporte',
    descricao: 'Modelo 57 — Documento de transporte de cargas.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" />
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
  },
  {
    sigla: 'MDF-e',
    nome: 'Manifesto de Documentos',
    descricao: 'Modelo 58 — Manifesto eletrônico de documentos fiscais.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    sigla: 'DC-e',
    nome: 'Declaração de Conteúdo',
    descricao: 'Declaração eletrônica de conteúdo desde abril/2026.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
];

const funcionalidades = [
  {
    titulo: 'Consulta por Chave',
    descricao: 'Acesse qualquer documento fiscal com apenas a chave de acesso de 44 dígitos.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    titulo: 'Consulta por CNPJ',
    descricao: 'Visualize todas as notas emitidas e recebidas por um CNPJ específico.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    titulo: 'Download de XML',
    descricao: 'Baixe o XML autorizado de qualquer documento fiscal consultado.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
  {
    titulo: 'Visualizar DANFE',
    descricao: 'Visualize e imprima o DANFE, DACTE ou DAMDFE em PDF.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
        <path d="M8 7h8" />
        <path d="M8 11h6" />
      </svg>
    ),
  },
  {
    titulo: 'API REST',
    descricao: 'Integre a consulta de documentos no seu sistema via API.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    titulo: 'Multi-Documento',
    descricao: 'NF-e, NFC-e, NFS-e, CT-e, MDF-e e DC-e — tudo em um lugar.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
];

const precos = [
  {
    nome: 'Grátis',
    preco: 'R$ 0',
    periodo: '/mês',
    destaque: false,
    recursos: [
      { inclui: true, texto: '50 consultas/mês' },
      { inclui: true, texto: 'NF-e, NFC-e, NFS-e' },
      { inclui: true, texto: 'Download XML' },
      { inclui: true, texto: 'Consulta por chave' },
      { inclui: false, texto: 'API REST' },
      { inclui: false, texto: 'CT-e, MDF-e, DC-e' },
    ],
    cta: 'Começar Grátis',
    href: '/auth/cadastrar',
  },
  {
    nome: 'Pro',
    preco: 'R$ 49',
    periodo: '/mês',
    destaque: true,
    recursos: [
      { inclui: true, texto: 'Consultas ilimitadas' },
      { inclui: true, texto: 'Todos os documentos' },
      { inclui: true, texto: 'Download XML + DANFE' },
      { inclui: true, texto: 'API REST (10K req/mês)' },
      { inclui: true, texto: 'Webhooks' },
      { inclui: true, texto: 'Suporte por email' },
    ],
    cta: 'Assinar Pro',
    href: '/auth/cadastrar',
  },
  {
    nome: 'Enterprise',
    preco: 'R$ 199',
    periodo: '/mês',
    destaque: false,
    recursos: [
      { inclui: true, texto: 'Tudo do Pro' },
      { inclui: true, texto: 'API ilimitada' },
      { inclui: true, texto: 'Multi-CNPJ' },
      { inclui: true, texto: 'Webhooks avançados' },
      { inclui: true, texto: 'Suporte prioritário' },
      { inclui: true, texto: 'SLA 99.9%' },
    ],
    cta: 'Falar com Vendas',
    href: '/contato',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center shrink-0">
              <img src="/logo-dark.png" alt="DFeCentral" className="h-8 w-auto" />
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              {['Documentos', 'Funcionalidades', 'Preços'].map((item) => (
                <Link
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {item}
                </Link>
              ))}
              <Link
                href="https://consulta.dfecentral.com.br"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Consulta
              </Link>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/documentacao"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                API Docs
              </Link>
            </nav>
            <div className="flex items-center gap-3">
              <Link
                href="/auth/entrar"
                className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                Entrar
              </Link>
              <Link
                href="/auth/cadastrar"
                className="inline-flex px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-full transition-all"
              >
                Criar Conta
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="relative pt-32 pb-24 sm:pt-40 sm:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50/50 via-white to-white" />
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-30">
          <div className="absolute top-20 right-20 w-72 h-72 bg-brand-300 rounded-full blur-3xl" />
          <div className="absolute top-40 right-60 w-96 h-96 bg-brand-400/30 rounded-full blur-3xl" />
        </div>
        <div className="absolute inset-0 bg-grid opacity-[0.03]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-50 border border-brand-200 rounded-full text-sm font-medium text-brand-700 mb-8 animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Plataforma fiscal completa
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 mb-6 text-balance animate-slide-up">
              Central de Documentos
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-400">
                Fiscais do Brasil
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-500 mb-10 max-w-2xl mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>
              Consulte, baixe e gerencie NF-e, NFC-e, NFS-e, CT-e, MDF-e e DC-e.
              Uma plataforma para todos os documentos fiscais eletrônicos do Brasil.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Link
                href="/auth/cadastrar"
                className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all shadow-xl shadow-slate-900/20"
              >
                Criar Conta Grátis
                <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                href="https://consulta.dfecentral.com.br"
                className="inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-slate-700 bg-white border-2 border-slate-200 hover:border-slate-300 rounded-xl transition-all"
              >
                Consultar Documento
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="relative -mt-8 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
              {[
                { valor: '6', label: 'Documentos Suportados' },
                { valor: '5M+', label: 'Consultas realizadas' },
                { valor: '99.9%', label: 'SLA de disponibilidade' },
                { valor: 'R$ 0', label: 'Para começar' },
              ].map((stat) => (
                <div key={stat.label} className="p-6 text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-slate-900">{stat.valor}</div>
                  <div className="text-sm text-slate-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="documentos" className="py-24 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold tracking-widest text-brand-600 uppercase">Documentos</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mt-3 mb-4">
              Tipos de Documentos Suportados
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Todos os tipos de documentos fiscais eletrônicos brasileiros em uma única plataforma.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {documentos.map((doc, i) => (
              <div
                key={doc.sigla}
                className="group bg-white p-6 rounded-xl border border-slate-200 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-100/50 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center mb-4 group-hover:bg-brand-100 transition-colors">
                  {doc.icon}
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <h3 className="text-lg font-bold text-slate-900">{doc.sigla}</h3>
                  <span className="text-xs font-medium text-brand-600">{doc.nome}</span>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">{doc.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="funcionalidades" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold tracking-widest text-brand-600 uppercase">Funcionalidades</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mt-3 mb-4">
              Tudo que você precisa
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Ferramentas completas para consultar e gerenciar documentos fiscais.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {funcionalidades.map((func, i) => (
              <div key={func.titulo} className="group p-6 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center mb-4 group-hover:bg-brand-100 transition-colors">
                  {func.icon}
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{func.titulo}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{func.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-slate-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-semibold tracking-widest text-brand-400 uppercase">API</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
              API para Desenvolvedores
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Integre a consulta de documentos fiscais no seu sistema com nossa REST API.
            </p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-800 border-b border-slate-700">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="ml-3 text-xs text-slate-400 font-mono">api.dfecentral.com.br</span>
            </div>
            <div className="p-4 sm:p-6 overflow-x-auto">
              <pre className="text-sm text-slate-300 font-mono leading-relaxed overflow-x-auto">
                <code>{`# Consultar NF-e por chave de acesso
GET /api/v1/nfe/{chave_acesso}
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
}`}</code>
              </pre>
            </div>
          </div>
          <div className="text-center mt-8">
            <Link
              href="/documentacao"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl transition-all"
            >
              Ver Documentação Completa
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <section id="preços" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold tracking-widest text-brand-600 uppercase">Preços</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mt-3 mb-4">
              Planos Simples e Transparentes
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Escolha o plano ideal para o seu negócio. Sem taxas escondidas.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {precos.map((plano) => (
              <div
                key={plano.nome}
                className={`relative bg-white rounded-2xl border-2 p-8 transition-all duration-300 hover:shadow-lg ${
                  plano.destaque
                    ? 'border-brand-500 shadow-xl shadow-brand-100/50 scale-105 md:scale-110'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {plano.destaque && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                    MAIS POPULAR
                  </div>
                )}
                <h3 className="text-lg font-semibold text-slate-900 mb-1">{plano.nome}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-slate-900">{plano.preco}</span>
                  <span className="text-sm text-slate-500">{plano.periodo}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plano.recursos.map((recurso) => (
                    <li key={recurso.texto} className="flex items-center gap-3 text-sm">
                      {recurso.inclui ? (
                        <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      <span className={recurso.inclui ? 'text-slate-700' : 'text-slate-400'}>{recurso.texto}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plano.href}
                  className={`block w-full py-3 text-center text-sm font-semibold rounded-xl transition-all ${
                    plano.destaque
                      ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20'
                      : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {plano.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-gradient-to-br from-brand-600 to-brand-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Comece a consultar documentos fiscais agora
          </h2>
          <p className="text-lg text-brand-200 mb-8 max-w-2xl mx-auto">
            Crie sua conta gratuita e comece a consultar NF-e, NFC-e, NFS-e, CT-e, MDF-e e DC-e em segundos.
          </p>
          <Link
            href="/auth/cadastrar"
            className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold text-brand-700 bg-white rounded-xl hover:bg-brand-50 transition-all shadow-xl shadow-black/20"
          >
            Criar Conta Grátis
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      <footer className="bg-slate-950 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
            <div className="col-span-2 md:col-span-1">
              <img src="/logo-light.png" alt="DFeCentral" className="h-8 w-auto mb-4 brightness-0 invert" />
              <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
                A central de documentos fiscais do Brasil. Consulte, baixe e gerencie todos os documentos fiscais eletrônicos.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Produto</h4>
              <ul className="space-y-3">
                {['Documentos', 'Funcionalidades', 'Preços'].map((item) => (
                  <li key={item}>
                    <Link href={`#${item.toLowerCase()}`} className="text-sm hover:text-white transition-colors">{item}</Link>
                  </li>
                ))}
                <li><Link href="/documentacao" className="text-sm hover:text-white transition-colors">API Docs</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Documentos</h4>
              <ul className="space-y-3">
                {['NF-e', 'NFC-e', 'NFS-e', 'CT-e', 'MDF-e', 'DC-e'].map((doc) => (
                  <li key={doc}>
                    <Link href={`/documentos/${doc.toLowerCase()}`} className="text-sm hover:text-white transition-colors">{doc}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Empresa</h4>
              <ul className="space-y-3">
                {['Sobre', 'Contato', 'Privacidade', 'Termos'].map((item) => (
                  <li key={item}>
                    <Link href={`/${item.toLowerCase()}`} className="text-sm hover:text-white transition-colors">{item}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              &copy; 2026 DFeCentral. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-6">
              {['Twitter', 'LinkedIn', 'GitHub'].map((social) => (
                <Link key={social} href="#" className="text-sm text-slate-600 hover:text-white transition-colors">
                  {social}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
