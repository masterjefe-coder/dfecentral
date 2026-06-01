import type { NextRequest } from 'next/server';
import { gerarPdfConsultadanfe, consultarNfePublicaConsultadanfe } from '@dfecentral/sdk/consultadanfe';

const ALLOWED_TYPES = new Set(['nfe', 'nfce', 'nfse', 'cte', 'mdfe', 'bpe', 'cteos', 'dce']);

const MODELO_PARA_TIPO: Record<string, string> = {
  '55': 'nfe',
  '65': 'nfce',
  '57': 'cte',
  '58': 'mdfe',
  '63': 'bpe',
  '67': 'cteos',
};

const TIPOS_SEM_CHAVE_44 = new Set(['nfse', 'dce']);

function getApiBaseUrl(): string {
  return process.env.API_BASE_URL || 'http://127.0.0.1:3004';
}

function getApiKey(): string | null {
  const candidates = [process.env.API_KEY, process.env.API_KEYS, process.env.API_PROXY_KEY].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const key = candidate.split(',').map((value) => value.trim()).find(Boolean);
    if (key) return key;
  }
  return null;
}

async function proxyXml(tipo: string, chave: string) {
  const apiKey = getApiKey();
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const upstream = await fetch(`${getApiBaseUrl()}/api/v1/${tipo}/${chave}/xml`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  const contentType = upstream.headers.get('content-type') || 'application/xml; charset=utf-8';
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': contentType },
  });
}

async function obterXmlUpstream(tipo: string, chave: string): Promise<string | null> {
  const apiKey = getApiKey();
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const upstream = await fetch(`${getApiBaseUrl()}/api/v1/${tipo}/${chave}/xml`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!upstream.ok) return null;

  const contentType = upstream.headers.get('content-type') || '';
  if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
    return upstream.text();
  }

  const text = await upstream.text();
  if (text.trim().startsWith('<')) return text;
  return null;
}

function tipoDaChave(chave: string): string | null {
  if (chave.length === 50) return 'nfse';
  if (chave.length === 56) return 'dce';
  return MODELO_PARA_TIPO[chave.slice(20, 22)] || null;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ tipo: string; chave: string }> }) {
  const { tipo, chave } = await context.params;
  if (!ALLOWED_TYPES.has(tipo)) {
    return Response.json({ sucesso: false, erro: 'Tipo de documento invalido' }, { status: 400 });
  }

  const tipoEsperado = tipoDaChave(chave);
  if (!tipoEsperado) {
    if (!TIPOS_SEM_CHAVE_44.has(tipo)) {
      return Response.json({ sucesso: false, erro: 'Nao foi possivel identificar o tipo pela chave' }, { status: 400 });
    }
  }

  if (tipoEsperado && tipoEsperado !== tipo) {
    return Response.json({ sucesso: false, erro: `A chave informada corresponde a ${tipoEsperado.toUpperCase()}` }, { status: 400 });
  }

  if (tipo === 'nfe') {
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

  const formato = String((new URL(_request.url).searchParams.get('format') || '')).toLowerCase();
  if (formato === 'danfe' || formato === 'pdf') {
    const xml = await obterXmlUpstream(tipo, chave);
    if (!xml) return Response.json({ sucesso: false, erro: 'XML nao disponivel' }, { status: 404 });

    const pdf = await gerarPdfConsultadanfe(xml, tipo);
    if (!pdf) return Response.json({ sucesso: false, erro: 'PDF nao disponivel' }, { status: 404 });

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${tipo}-${chave}.pdf"`,
      },
    });
  }

  return proxyXml(tipo, chave);
}
