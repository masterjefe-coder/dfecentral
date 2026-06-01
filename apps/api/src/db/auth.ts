import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './index.js';
import { usuarios } from './schema.js';

export type UsuarioAuth = typeof usuarios.$inferSelect;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function gerarApiKey(): string {
  return randomBytes(32).toString('hex');
}

export function hashSenha(senha: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = gerarHashIterativo(senha, salt);
  return `sha256$100000$${salt}$${hash}`;
}

export function verificarSenha(senha: string, senhaHash: string): boolean {
  const partes = senhaHash.split('$');
  if (partes.length !== 4 || partes[0] !== 'sha256') return false;

  const salt = partes[2];
  const esperado = Buffer.from(partes[3], 'hex');
  const calculado = Buffer.from(gerarHashIterativo(senha, salt), 'hex');

  if (calculado.length !== esperado.length) return false;
  return timingSafeEqual(calculado, esperado);
}

function gerarHashIterativo(senha: string, salt: string): string {
  let atual = Buffer.from(`${senha}:${salt}`, 'utf8');
  for (let i = 0; i < 100000; i += 1) {
    atual = createHash('sha256').update(atual).digest();
  }
  return atual.toString('hex');
}

export async function encontrarUsuarioPorEmail(email: string): Promise<UsuarioAuth | null> {
  const resultado = await db.select().from(usuarios).where(eq(usuarios.email, normalizeEmail(email))).limit(1);
  return resultado[0] || null;
}

export async function encontrarUsuarioPorApiKey(apiKey: string): Promise<UsuarioAuth | null> {
  const resultado = await db.select().from(usuarios).where(eq(usuarios.apiKey, apiKey)).limit(1);
  return resultado[0] || null;
}

export async function criarUsuario(input: {
  nome: string;
  email: string;
  senha: string;
  cnpj?: string | null;
  plano?: string;
}): Promise<UsuarioAuth> {
  const [usuario] = await db
    .insert(usuarios)
    .values({
      nome: input.nome.trim(),
      email: normalizeEmail(input.email),
      senhaHash: hashSenha(input.senha),
      cnpj: input.cnpj?.replace(/\D/g, '') || null,
      plano: input.plano || 'free',
      apiKey: gerarApiKey(),
    })
    .returning();

  return usuario;
}

export async function atualizarSenhaUsuario(usuarioId: string, senha: string): Promise<void> {
  await db.update(usuarios).set({ senhaHash: hashSenha(senha), atualizadoEm: new Date() }).where(eq(usuarios.id, usuarioId));
}

export async function atualizarPerfilUsuario(
  usuarioId: string,
  input: { nome?: string; cnpj?: string | null },
): Promise<UsuarioAuth | null> {
  const updates: Partial<typeof usuarios.$inferInsert> = { atualizadoEm: new Date() };
  if (typeof input.nome === 'string' && input.nome.trim()) updates.nome = input.nome.trim();
  if (input.cnpj !== undefined) updates.cnpj = input.cnpj ? input.cnpj.replace(/\D/g, '') : null;

  const resultado = await db.update(usuarios).set(updates).where(eq(usuarios.id, usuarioId)).returning();
  return resultado[0] || null;
}

export async function obterEmpresaAtiva(usuarioId: string): Promise<string | null> {
  const usuario = await db.select({ cnpjAtivo: usuarios.cnpjAtivo, cnpj: usuarios.cnpj }).from(usuarios).where(eq(usuarios.id, usuarioId)).limit(1);
  const ativo = usuario[0]?.cnpjAtivo || usuario[0]?.cnpj || null;
  return ativo || null;
}

export async function atualizarEmpresaAtiva(usuarioId: string, cnpjAtivo: string | null): Promise<void> {
  await db
    .update(usuarios)
    .set({ cnpjAtivo: cnpjAtivo ? cnpjAtivo.replace(/\D/g, '').slice(0, 14) : null, atualizadoEm: new Date() })
    .where(eq(usuarios.id, usuarioId));
}

export async function obterPreferenciasUsuario(usuarioId: string): Promise<Record<string, unknown>> {
  const resultado = await db.select({ preferencias: usuarios.preferencias }).from(usuarios).where(eq(usuarios.id, usuarioId)).limit(1);
  return (resultado[0]?.preferencias as Record<string, unknown>) || {};
}

export async function atualizarPreferenciasUsuario(usuarioId: string, preferencias: Record<string, unknown>): Promise<void> {
  await db.update(usuarios).set({ preferencias, atualizadoEm: new Date() }).where(eq(usuarios.id, usuarioId));
}

export async function garantirUsuarioGoogle(input: { nome: string; email: string; cnpj?: string | null }): Promise<UsuarioAuth> {
  const email = normalizeEmail(input.email);
  const existente = await encontrarUsuarioPorEmail(email);
  if (existente) {
    if (!existente.apiKey) {
      const [atualizado] = await db
        .update(usuarios)
        .set({ apiKey: gerarApiKey(), atualizadoEm: new Date() })
        .where(eq(usuarios.id, existente.id))
        .returning();
      return atualizado;
    }

    return existente;
  }

  const senhaTemporaria = randomBytes(24).toString('hex');
  return criarUsuario({
    nome: input.nome,
    email,
    senha: senhaTemporaria,
    cnpj: input.cnpj || null,
  });
}
