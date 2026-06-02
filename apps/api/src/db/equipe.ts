import { and, desc, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { db } from './index.js';
import { convitesEmpresa, empresasUsuario, usuarios } from './schema.js';

export type ConviteEmpresa = typeof convitesEmpresa.$inferSelect;

function normalizarCnpj(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, 14);
}

function gerarTokenConvite(): string {
  return randomBytes(24).toString('hex');
}

export async function listarMembrosEmpresa(cnpj: string) {
  return db.select().from(empresasUsuario).where(eq(empresasUsuario.cnpj, normalizarCnpj(cnpj))).orderBy(desc(empresasUsuario.criadoEm));
}

export async function listarConvitesEmpresa(cnpj: string) {
  return db.select().from(convitesEmpresa).where(eq(convitesEmpresa.cnpj, normalizarCnpj(cnpj))).orderBy(desc(convitesEmpresa.criadoEm));
}

export async function criarConviteEmpresa(input: {
  usuarioId: string;
  cnpj: string;
  nome: string;
  email: string;
  papel?: string;
}): Promise<ConviteEmpresa> {
  const [convite] = await db
    .insert(convitesEmpresa)
    .values({
      usuarioId: input.usuarioId,
      cnpj: normalizarCnpj(input.cnpj),
      nome: input.nome.trim(),
      email: input.email.trim().toLowerCase(),
      papel: input.papel || 'membro',
      token: gerarTokenConvite(),
      status: 'pendente',
    })
    .returning();

  return convite;
}

export async function aceitarConviteEmpresa(input: { usuarioId: string; token: string }): Promise<{ cnpj: string } | null> {
  const convite = await db
    .select()
    .from(convitesEmpresa)
    .where(and(eq(convitesEmpresa.token, input.token), eq(convitesEmpresa.status, 'pendente')))
    .limit(1);

  const atual = convite[0];
  if (!atual) return null;

  const usuario = await db.select().from(usuarios).where(eq(usuarios.id, input.usuarioId)).limit(1);
  const current = usuario[0];
  if (!current || current.email.toLowerCase() !== atual.email.toLowerCase()) {
    return null;
  }

  const existente = await db
    .select()
    .from(empresasUsuario)
    .where(and(eq(empresasUsuario.usuarioId, input.usuarioId), eq(empresasUsuario.cnpj, atual.cnpj)))
    .limit(1);

  if (existente.length === 0) {
    await db.insert(empresasUsuario).values({
      usuarioId: input.usuarioId,
      nome: atual.nome,
      cnpj: atual.cnpj,
    });
  }

  await db
    .update(convitesEmpresa)
    .set({ status: 'aceito', aceitoEm: new Date() })
    .where(eq(convitesEmpresa.id, atual.id));

  return { cnpj: atual.cnpj };
}

export async function revogarConviteEmpresa(input: { usuarioId: string; conviteId: string }): Promise<boolean> {
  const resultado = await db
    .delete(convitesEmpresa)
    .where(and(eq(convitesEmpresa.id, input.conviteId), eq(convitesEmpresa.usuarioId, input.usuarioId)))
    .returning();
  return resultado.length > 0;
}
