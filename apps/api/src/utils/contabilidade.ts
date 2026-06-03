import JSZip from 'jszip';
import { and, eq, gte, lt, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { documentos } from '../db/schema.js';
import { obterEmpresaAtiva, obterPreferenciasUsuario } from '../db/auth.js';
import { enviarEmailComAnexo } from './mailer.js';
import { enviarArquivoParaR2, r2EstaConfigurado } from './r2.js';

export type DirecaoXml = 'emitidas' | 'entradas';

export interface DocumentoXmlPacote {
  chaveAcesso: string;
  tipo: string;
  dataEmissao: Date;
  xml: string;
  direcao: DirecaoXml;
}

export function normalizarMesPacote(valor?: string): string {
  if (valor && /^\d{4}-\d{2}$/.test(valor)) return valor;
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}

function inicioMes(mes: string): Date {
  const [ano, numeroMes] = mes.split('-').map(Number);
  return new Date(Date.UTC(ano, numeroMes - 1, 1, 0, 0, 0, 0));
}

function inicioProximoMes(mes: string): Date {
  const [ano, numeroMes] = mes.split('-').map(Number);
  return new Date(Date.UTC(ano, numeroMes, 1, 0, 0, 0, 0));
}

export async function obterDocumentosXmlMes(usuarioId: string, mes: string, incluirEntradas: boolean): Promise<DocumentoXmlPacote[]> {
  const cnpj = await obterEmpresaAtiva(usuarioId);
  if (!cnpj) return [];

  const condicoes: any[] = [gte(documentos.dataEmissao, inicioMes(mes)), lt(documentos.dataEmissao, inicioProximoMes(mes))];
  condicoes.push(
    incluirEntradas
      ? or(eq(documentos.cnpjEmitente, cnpj), eq(documentos.cnpjDestinatario, cnpj))
      : eq(documentos.cnpjEmitente, cnpj),
  );

  const selecionados = await db.select().from(documentos).where(and(...condicoes));
  const vistos = new Set<string>();

  return selecionados
    .filter((doc) => doc.xmlCompleto)
    .filter((doc) => {
      if (vistos.has(doc.chaveAcesso)) return false;
      vistos.add(doc.chaveAcesso);
      return true;
    })
    .map((doc) => ({
      chaveAcesso: doc.chaveAcesso,
      tipo: doc.tipo,
      dataEmissao: new Date(doc.dataEmissao),
      xml: typeof doc.xmlCompleto === 'string' ? doc.xmlCompleto : JSON.stringify(doc.xmlCompleto, null, 2),
      direcao: doc.cnpjEmitente === cnpj ? ('emitidas' as const) : ('entradas' as const),
    }));
}

export function obterEmailContabilidade(preferencias: unknown): string | null {
  const prefs = (preferencias || {}) as Record<string, unknown>;
  const email = prefs.contabilidadeEmail;
  return typeof email === 'string' && email.includes('@') ? email : null;
}

export async function enviarXmlContabilidadeAutomatico(opcoes: {
  usuarioId?: string | null;
  chave: string;
  xml: string;
}): Promise<void> {
  if (!opcoes.usuarioId) return;

  const preferencias = await obterPreferenciasUsuario(opcoes.usuarioId);
  const auto = Boolean(preferencias.contabilidadeEnvioAutomatico);
  if (!auto) return;

  const destino = obterEmailContabilidade(preferencias);
  if (!destino) return;

  await enviarEmailComAnexo({
    to: destino,
    subject: `XML fiscal ${opcoes.chave}`,
    text: `Segue em anexo o XML fiscal da chave ${opcoes.chave}.`,
    html: `<p>Segue em anexo o XML fiscal da chave <strong>${opcoes.chave}</strong>.</p>`,
    attachments: [
      {
        filename: `xml-${opcoes.chave}.xml`,
        content: opcoes.xml,
        contentType: 'application/xml',
      },
    ],
  });
}

function formatarMesArquivo(mes: string): string {
  return mes.replace('-', '_');
}

export async function criarPacoteXmlMensal(opcoes: {
  mes: string;
  documentos: DocumentoXmlPacote[];
  incluirEntradas: boolean;
}): Promise<{ nomeArquivo: string; buffer: Buffer; total: number }> {
  const pacote = new JSZip();

  const itens = [...opcoes.documentos].sort((a, b) => a.chaveAcesso.localeCompare(b.chaveAcesso));
  for (const doc of itens) {
    const data = doc.dataEmissao.toISOString().slice(0, 10);
    const pasta = doc.direcao === 'entradas' ? 'entradas' : 'emitidas';
    const nome = `${pasta}/${data}-${doc.tipo}-${doc.chaveAcesso}.xml`;
    pacote.file(nome, doc.xml);
  }

  pacote.file(
    'manifesto.json',
    JSON.stringify(
      {
        mes: opcoes.mes,
        incluirEntradas: opcoes.incluirEntradas,
        total: itens.length,
        geradoEm: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  const buffer = await pacote.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  return {
    nomeArquivo: `xmls-${formatarMesArquivo(opcoes.mes)}.zip`,
    buffer,
    total: itens.length,
  };
}

export async function arquivarXmlEmR2(opcoes: {
  usuarioId?: string | null;
  chave: string;
  xml: string;
  dataEmissao: Date;
  tipo: string;
  direcao: DirecaoXml;
}): Promise<{ bucket: string; key: string } | null> {
  if (!r2EstaConfigurado() || !opcoes.usuarioId) return null;

  const preferencias = await obterPreferenciasUsuario(opcoes.usuarioId);
  if (!preferencias.arquivamentoXmlAtivo) return null;

  return enviarArquivoParaR2({
    chave: opcoes.chave,
    corpo: opcoes.xml,
    contentType: 'application/xml',
    categoria: 'xml',
    dataEmissao: opcoes.dataEmissao,
    nomeArquivo: `${opcoes.direcao}/${opcoes.tipo}-${opcoes.chave}.xml`,
  });
}

export async function enviarPacoteXmlMensal(opcoes: {
  usuarioId?: string | null;
  to: string;
  mes: string;
  incluirEntradas: boolean;
  documentos: DocumentoXmlPacote[];
}): Promise<{ nomeArquivo: string; total: number; r2?: { bucket: string; key: string } | null }> {
  const pacote = await criarPacoteXmlMensal({
    mes: opcoes.mes,
    incluirEntradas: opcoes.incluirEntradas,
    documentos: opcoes.documentos,
  });

  const r2 = r2EstaConfigurado()
    && opcoes.usuarioId
    ? await enviarArquivoParaR2({
        chave: `pacote-${opcoes.mes}`,
        corpo: pacote.buffer,
        contentType: 'application/zip',
        categoria: 'pacote',
        nomeArquivo: `xmls-${formatarMesArquivo(opcoes.mes)}.zip`,
      })
    : null;

  await enviarEmailComAnexo({
    to: opcoes.to,
    subject: `Pacote XML mensal ${opcoes.mes}`,
    text: `Segue em anexo o pacote ZIP com os XMLs do mes ${opcoes.mes}.`,
    html: `<p>Segue em anexo o pacote ZIP com os XMLs do mes <strong>${opcoes.mes}</strong>.</p>`,
    attachments: [
      {
        filename: pacote.nomeArquivo,
        content: pacote.buffer,
        contentType: 'application/zip',
      },
    ],
  });

  return { nomeArquivo: pacote.nomeArquivo, total: pacote.total, r2 };
}

export function mesAnterior(valor: Date = new Date()): string {
  const ano = valor.getUTCMonth() === 0 ? valor.getUTCFullYear() - 1 : valor.getUTCFullYear();
  const mes = valor.getUTCMonth() === 0 ? 12 : valor.getUTCMonth();
  return `${ano}-${String(mes).padStart(2, '0')}`;
}
