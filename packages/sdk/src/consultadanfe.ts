import type { ConsultaResultado } from './types.js';

const BASE_URL = 'https://consultadanfe.com';

interface ConsultaDanfeResponse {
  status?: string;
  chave?: string;
  tipo?: string;
  pdf_base64?: string;
  xml_base64?: string;
  xml?: string;
  recovery?: boolean;
  info?: string;
  erro?: string;
  message?: string;
}

function extrairValor(xml: string, caminho: string): string | undefined {
  const partes = caminho.split('.');
  let atual: string | undefined = xml;

  for (const parte of partes) {
    if (!atual) return undefined;
    const match: RegExpMatchArray | null = atual.match(new RegExp(`<${parte}[^>]*>([\\s\\S]*?)<\/${parte}>`));
    atual = match ? match[1] : undefined;
  }

  return atual?.trim();
}

function parseNfeConsultadanfeXml(xml: string) {
  const nfeProc = xml.match(/<nfeProc[^>]*>[\s\S]*?<NFe[^>]*>[\s\S]*?<infNFe[^>]*>([\s\S]*?)<\/infNFe>[\s\S]*?<\/NFe>[\s\S]*?<\/nfeProc>/i)?.[1]
    || xml.match(/<NFe[^>]*>[\s\S]*?<infNFe[^>]*>([\s\S]*?)<\/infNFe>[\s\S]*?<\/NFe>/i)?.[1]
    || null;

  if (!nfeProc) return null;

  const chaveAcesso = (xml.match(/Id="NFe([0-9A-Za-z]{44})"/i)?.[1] || '').trim();
  const emitCNPJ = extrairValor(nfeProc, 'emit.CNPJ') || '';
  const destCNPJ = extrairValor(nfeProc, 'dest.CNPJ') || '';

  return {
    chaveAcesso,
    tipo: 'nfe' as const,
    numero: extrairValor(nfeProc, 'ide.nNF') || '',
    serie: extrairValor(nfeProc, 'ide.serie') || '',
    dataEmissao: extrairValor(nfeProc, 'ide.dhEmi') || extrairValor(nfeProc, 'ide.dEmi') || '',
    cnpjEmitente: emitCNPJ,
    razaoSocialEmitente: extrairValor(nfeProc, 'emit.xNome') || '',
    cnpjDestinatario: destCNPJ || undefined,
    razaoSocialDestinatario: extrairValor(nfeProc, 'dest.xNome') || undefined,
    valorTotal: extrairValor(nfeProc, 'total.ICMSTot.vNF') || '0',
    status: 'autorizada' as const,
    protocolo: extrairValor(xml, 'protNFe.infProt.nProt') || undefined,
  };
}

function decodificarBase64Texto(valor?: string): string | undefined {
  if (!valor) return undefined;
  try {
    return Buffer.from(valor, 'base64').toString('utf-8');
  } catch {
    return undefined;
  }
}

async function responseParaBuffer(res: Response): Promise<Buffer | null> {
  if (!res.ok) return null;

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/pdf')) {
    return Buffer.from(await res.arrayBuffer());
  }

  const data = (await res.json().catch(() => null)) as ConsultaDanfeResponse | null;
  if (!data?.pdf_base64) return null;
  return Buffer.from(data.pdf_base64, 'base64');
}

export async function consultarNfePublicaConsultadanfe(chave: string): Promise<ConsultaResultado> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/consulta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ chave }),
      cache: 'no-store',
    });

    const data = (await res.json().catch(() => null)) as ConsultaDanfeResponse | null;
    if (!res.ok || !data) {
      return { sucesso: false, erro: data?.erro || `ConsultaDanfe: HTTP ${res.status}`, fonte: 'mock' };
    }

    const xml = data.xml || decodificarBase64Texto(data.xml_base64);
    if (!xml) {
      return { sucesso: false, erro: 'ConsultaDanfe sem XML', fonte: 'mock' };
    }

    const documento = parseNfeConsultadanfeXml(xml);
    if (!documento) {
      return { sucesso: false, erro: 'ConsultaDanfe retornou XML nao interpretavel', fonte: 'mock' };
    }

    return { sucesso: true, documento: { ...documento, xml }, fonte: 'sefaz' };
  } catch (error: any) {
    return { sucesso: false, erro: error?.message || 'Erro na ConsultaDanfe', fonte: 'mock' };
  }
}

export async function gerarPdfConsultadanfe(xml: string, tipo?: string): Promise<Buffer | null> {
  try {
    const form = new FormData();
    form.append('xml', new Blob([xml], { type: 'application/xml' }), 'documento.xml');
    if (tipo) form.append('tipo', tipo);
    form.append('format', 'pdf');

    const res = await fetch(`${BASE_URL}/api/v1/danfe`, {
      method: 'POST',
      body: form,
      cache: 'no-store',
    });

    return await responseParaBuffer(res);
  } catch {
    return null;
  }
}

export async function gerarPdfNFepelaChaveConsultadanfe(chave: string): Promise<Buffer | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/consulta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ chave }),
      cache: 'no-store',
    });

    const data = (await res.json().catch(() => null)) as ConsultaDanfeResponse | null;
    if (!res.ok || !data) return null;

    if (data.pdf_base64) {
      return Buffer.from(data.pdf_base64, 'base64');
    }

    const xml = data.xml || decodificarBase64Texto(data.xml_base64);
    if (!xml) return null;

    return await gerarPdfConsultadanfe(xml, 'nfe');
  } catch {
    return null;
  }
}
