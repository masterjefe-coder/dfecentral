import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'DFeCentral - Central de Documentos Fiscais do Brasil',
    template: '%s | DFeCentral',
  },
  description:
    'Consulte, baixe e gerencie todos os documentos fiscais eletrônicos do Brasil. NF-e, NFS-e, CT-e, MDF-e, NFC-e e DC-e em uma única plataforma.',
  keywords: [
    'nota fiscal eletrônica',
    'NF-e',
    'NFS-e',
    'CT-e',
    'MDF-e',
    'NFC-e',
    'DC-e',
    'consulta nota fiscal',
    'documento fiscal',
    'SEFAZ',
    'API fiscal',
  ],
  authors: [{ name: 'DFeCentral' }],
  creator: 'DFeCentral',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://www.dfecentral.com.br',
    siteName: 'DFeCentral',
    title: 'DFeCentral - Central de Documentos Fiscais do Brasil',
    description:
      'Consulte, baixe e gerencie todos os documentos fiscais eletrônicos do Brasil.',
    images: [{ url: '/logo-light.png', width: 1185, height: 264 }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
