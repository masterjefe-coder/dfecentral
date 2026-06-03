import { and, desc, eq } from 'drizzle-orm';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { db } from './index.js';
import { certificadosDigitais } from './schema.js';

export type CertificadoDigital = typeof certificadosDigitais.$inferSelect;

type Envelope = { iv: string; tag: string; data: string };

function segredoCriptografia(): Buffer {
  const segredo = process.env.CERT_STORAGE_SECRET || process.env.AUTH_SECRET || process.env.API_KEY || 'dfecentral-cert-secret';
  return createHash('sha256').update(segredo).digest();
}

function codificarEnvelope(buffer: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', segredoCriptografia(), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope: Envelope = { iv: iv.toString('base64'), tag: tag.toString('base64'), data: encrypted.toString('base64') };
  return JSON.stringify(envelope);
}

function decodificarEnvelope(valor: string): Buffer {
  const envelope = JSON.parse(valor) as Partial<Envelope>;
  if (!envelope.iv || !envelope.tag || !envelope.data) throw new Error('Envelope de criptografia invalido');
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const data = Buffer.from(envelope.data, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', segredoCriptografia(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

export function criptografarTexto(valor: string): string {
  return codificarEnvelope(Buffer.from(valor, 'utf8'));
}

export function descriptografarTexto(valor: string): string {
  return decodificarEnvelope(valor).toString('utf8');
}

export function criptografarBuffer(buffer: Buffer): string {
  return codificarEnvelope(buffer);
}

export function descriptografarBuffer(valor: string): Buffer {
  return decodificarEnvelope(valor);
}

export async function obterCertificadoDigitalUsuario(usuarioId: string, cnpj?: string | null): Promise<CertificadoDigital | null> {
  if (cnpj) {
    const resultado = await db
      .select()
      .from(certificadosDigitais)
      .where(and(eq(certificadosDigitais.usuarioId, usuarioId), eq(certificadosDigitais.cnpj, cnpj.replace(/\D/g, '').slice(0, 14))))
      .orderBy(desc(certificadosDigitais.atualizadoEm))
      .limit(1);
    return resultado[0] || null;
  }

  const resultado = await db
    .select()
    .from(certificadosDigitais)
    .where(eq(certificadosDigitais.usuarioId, usuarioId))
    .orderBy(desc(certificadosDigitais.atualizadoEm))
    .limit(1);

  return resultado[0] || null;
}

export async function salvarCertificadoDigital(input: {
  usuarioId: string;
  cnpj: string;
  certificadoCnpj: string;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
  validadeEm: Date;
  arquivo: Buffer;
  senha: string;
}): Promise<CertificadoDigital> {
  const existente = await obterCertificadoDigitalUsuario(input.usuarioId, input.cnpj);
  const valores = {
    usuarioId: input.usuarioId,
    cnpj: input.cnpj.replace(/\D/g, '').slice(0, 14),
    certificadoCnpj: input.certificadoCnpj.replace(/\D/g, '').slice(0, 14),
    nomeArquivo: input.nomeArquivo.trim(),
    mimeType: input.mimeType.trim() || 'application/x-pkcs12',
    tamanhoBytes: input.tamanhoBytes,
    validadeEm: input.validadeEm,
    arquivoCriptografado: criptografarBuffer(input.arquivo),
    senhaCriptografada: criptografarTexto(input.senha),
    atualizadoEm: new Date(),
  };

  if (existente) {
    const [atualizado] = await db
      .update(certificadosDigitais)
      .set(valores)
      .where(eq(certificadosDigitais.id, existente.id))
      .returning();
    return atualizado;
  }

  const [criado] = await db.insert(certificadosDigitais).values({ ...valores, criadoEm: new Date() }).returning();
  return criado;
}

export async function removerCertificadoDigital(usuarioId: string, cnpj?: string | null): Promise<boolean> {
  const existente = await obterCertificadoDigitalUsuario(usuarioId, cnpj);
  if (!existente) return false;
  await db.delete(certificadosDigitais).where(eq(certificadosDigitais.id, existente.id));
  return true;
}
