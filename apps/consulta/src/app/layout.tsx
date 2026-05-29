import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://consulta.dfecentral.com.br'),
  title: 'Consulta Fiscal - DFeCentral',
  description: 'Consulte documentos fiscais eletrônicos brasileiros. NF-e, NFS-e, CT-e, MDF-e, NFC-e e DC-e.',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://consulta.dfecentral.com.br',
    siteName: 'DFeCentral',
    title: 'Consulta Fiscal - DFeCentral',
    description: 'Consulte documentos fiscais eletrônicos brasileiros.',
    images: [{ url: '/logo.png', width: 1185, height: 264 }],
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
