import type { NextRequest } from 'next/server';
import { consultarNfePublicaConsultadanfe } from '@dfecentral/sdk/consultadanfe';

async function consultarNfePublica(chave: string) {
  return consultarNfePublicaConsultadanfe(chave);
}

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

  const resultado = await consultarNfePublica(chave);
  if (!resultado.sucesso || !resultado.documento) {
    return Response.json({ sucesso: false, erro: resultado.erro || 'NF-e nao encontrada' }, { status: 404 });
  }

  return Response.json({
    sucesso: true,
    dados: { ...resultado.documento, fonte: 'consultadanfe' },
  });
}
