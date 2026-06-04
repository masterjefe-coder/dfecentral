import { and, asc, desc, eq, isNull, lte, or } from 'drizzle-orm';
import { db } from './index.js';
import { distribuicoesDfe } from './schema.js';

export type DistribuicaoDfe = typeof distribuicoesDfe.$inferSelect;

export async function obterDistribuicaoDfe(usuarioId: string, cnpj: string, tipo = 'nfe'): Promise<DistribuicaoDfe | null> {
  const cnpjLimpo = cnpj.replace(/\D/g, '').slice(0, 14);
  const resultado = await db
    .select()
    .from(distribuicoesDfe)
    .where(and(eq(distribuicoesDfe.usuarioId, usuarioId), eq(distribuicoesDfe.cnpj, cnpjLimpo), eq(distribuicoesDfe.tipo, tipo)))
    .limit(1);
  return resultado[0] || null;
}

export async function listarDistribuicoesProntas(agora = new Date(), tipo = 'nfe'): Promise<DistribuicaoDfe[]> {
  return db
    .select()
    .from(distribuicoesDfe)
    .where(and(eq(distribuicoesDfe.tipo, tipo), or(isNull(distribuicoesDfe.proximaExecucaoEm), lte(distribuicoesDfe.proximaExecucaoEm, agora))))
    .orderBy(asc(distribuicoesDfe.proximaExecucaoEm), desc(distribuicoesDfe.atualizadoEm));
}

export async function salvarDistribuicaoDfe(input: {
  usuarioId: string;
  cnpj: string;
  tipo?: string;
  ufIndice: number;
  ultNsu: string;
  ultimoCStat?: string | null;
  ultimoXMotivo?: string | null;
  proximaExecucaoEm?: Date | null;
}): Promise<DistribuicaoDfe> {
  const tipo = input.tipo || 'nfe';
  const existente = await obterDistribuicaoDfe(input.usuarioId, input.cnpj, tipo);
  const valores = {
    usuarioId: input.usuarioId,
    cnpj: input.cnpj.replace(/\D/g, '').slice(0, 14),
    tipo,
    ufIndice: Math.max(0, input.ufIndice),
    ultNsu: input.ultNsu.replace(/\D/g, '').padStart(15, '0').slice(0, 15),
    ultimoCStat: input.ultimoCStat || null,
    ultimoXMotivo: input.ultimoXMotivo || null,
    proximaExecucaoEm: input.proximaExecucaoEm || null,
    atualizadoEm: new Date(),
  };

  if (existente) {
    const [atualizado] = await db
      .update(distribuicoesDfe)
      .set(valores)
      .where(eq(distribuicoesDfe.id, existente.id))
      .returning();
    return atualizado;
  }

  const [criado] = await db.insert(distribuicoesDfe).values({ ...valores, criadoEm: new Date() }).returning();
  return criado;
}
