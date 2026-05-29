import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Consulta Fiscal - DFeCentral',
  description:
    'Consulte documentos fiscais eletrônicos brasileiros. NF-e, NFS-e, CT-e, MDF-e, NFC-e e DC-e.',
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
