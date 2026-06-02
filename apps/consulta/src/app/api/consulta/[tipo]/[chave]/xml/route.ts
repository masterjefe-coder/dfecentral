import type { NextRequest } from 'next/server';
import { gerarPdfConsultadanfe, consultarNfePublicaConsultadanfe } from '@dfecentral/sdk/consultadanfe';

function tipoDaChave(chave: string): string | null {
  if (!/^\d{44}$/.test(chave)) return null;
  return chave.slice(20, 22) === '55' ? 'nfe' : null;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ tipo: string; chave: string }> }) {
  const { tipo, chave } = await context.params;
  if (tipo !== 'nfe') {
    return Response.json({ sucesso: false, erro: 'A consulta publica aceita somente NF-e' }, { status: 400 });
  }

  const tipoEsperado = tipoDaChave(chave);
  if (tipoEsperado !== 'nfe') {
    return Response.json({ sucesso: false, erro: 'A chave informada nao corresponde a uma NF-e' }, { status: 400 });
  }

  const resultado = await consultarNfePublicaConsultadanfe(chave);
  if (!resultado.sucesso || !resultado.documento?.xml) {
    return Response.json({ sucesso: false, erro: resultado.erro || 'XML nao disponivel' }, { status: 404 });
  }

  const formato = String((new URL(_request.url).searchParams.get('format') || '')).toLowerCase();
  if (formato === 'danfe' || formato === 'pdf') {
    const pdf = await gerarPdfConsultadanfe(resultado.documento.xml, 'nfe');
    if (!pdf) {
      return Response.json({ sucesso: false, erro: 'PDF nao disponivel' }, { status: 404 });
    }

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="danfe-${chave}.pdf"`,
      },
    });
  }

  return new Response(resultado.documento.xml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
