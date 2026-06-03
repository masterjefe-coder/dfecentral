import { and, asc, desc, eq, lte } from 'drizzle-orm';
import { db } from './index.js';
import { assinaturasCobrancas, usuarios } from './schema.js';

export type MetodoPagamentoAssinatura = 'cartao' | 'pix_boleto';
export type OrigemCobrancaAssinatura = 'assinatura' | 'renovacao' | 'troca_metodo';

export type CobrancaAssinatura = typeof assinaturasCobrancas.$inferSelect;

export async function obterCobrancaAssinaturaPendente(usuarioId: string): Promise<CobrancaAssinatura | null> {
  const resultado = await db
    .select()
    .from(assinaturasCobrancas)
    .where(and(eq(assinaturasCobrancas.usuarioId, usuarioId), eq(assinaturasCobrancas.status, 'pendente')))
    .orderBy(desc(assinaturasCobrancas.criadoEm))
    .limit(1);

  return resultado[0] || null;
}

export async function obterCobrancaAssinaturaPorReferencia(externalReference: string): Promise<CobrancaAssinatura | null> {
  const resultado = await db.select().from(assinaturasCobrancas).where(eq(assinaturasCobrancas.externalReference, externalReference)).limit(1);
  return resultado[0] || null;
}

export async function listarCobrancasAssinaturaVencidas(ate: Date): Promise<CobrancaAssinatura[]> {
  return db
    .select()
    .from(assinaturasCobrancas)
    .where(and(eq(assinaturasCobrancas.status, 'pendente'), lte(assinaturasCobrancas.venceEm, ate)))
    .orderBy(asc(assinaturasCobrancas.venceEm));
}

export async function salvarCobrancaAssinatura(input: {
  usuarioId: string;
  plano: string;
  metodoPagamento: MetodoPagamentoAssinatura;
  origem?: OrigemCobrancaAssinatura;
  externalReference: string;
  checkoutUrl: string;
  venceEm: Date;
}): Promise<CobrancaAssinatura> {
  const existente = await obterCobrancaAssinaturaPendente(input.usuarioId);
  if (existente) {
    const [atualizada] = await db
      .update(assinaturasCobrancas)
      .set({
        plano: input.plano,
        metodoPagamento: input.metodoPagamento,
        origem: input.origem || existente.origem,
        externalReference: input.externalReference,
        checkoutUrl: input.checkoutUrl,
        venceEm: input.venceEm,
        status: 'pendente',
        pagoEm: null,
        atualizadoEm: new Date(),
      })
      .where(eq(assinaturasCobrancas.id, existente.id))
      .returning();

    return atualizada;
  }

  const [criada] = await db
    .insert(assinaturasCobrancas)
    .values({
      usuarioId: input.usuarioId,
      plano: input.plano,
      metodoPagamento: input.metodoPagamento,
      origem: input.origem || 'assinatura',
      externalReference: input.externalReference,
      checkoutUrl: input.checkoutUrl,
      venceEm: input.venceEm,
    })
    .returning();

  return criada;
}

export async function marcarCobracaoAssinaturaComoPaga(externalReference: string, pagoEm = new Date()): Promise<CobrancaAssinatura | null> {
  const existente = await obterCobrancaAssinaturaPorReferencia(externalReference);
  if (!existente) return null;

  const [atualizada] = await db
    .update(assinaturasCobrancas)
    .set({ status: 'paga', pagoEm, atualizadoEm: new Date() })
    .where(eq(assinaturasCobrancas.id, existente.id))
    .returning();

  return atualizada || null;
}

export async function atualizarAssinaturaMetodoPagamento(usuarioId: string, metodoPagamento: MetodoPagamentoAssinatura): Promise<void> {
  await db.update(usuarios).set({ assinaturaMetodoPagamento: metodoPagamento, atualizadoEm: new Date() }).where(eq(usuarios.id, usuarioId));
}

export async function ajustarProximaCobrancaUsuario(usuarioId: string, proximaEm: Date): Promise<void> {
  await db.update(usuarios).set({ assinaturaRenovaEm: proximaEm, atualizadoEm: new Date() }).where(eq(usuarios.id, usuarioId));
}
