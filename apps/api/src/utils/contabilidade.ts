import JSZip from 'jszip';
import { obterPreferenciasUsuario } from '../db/auth.js';
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
