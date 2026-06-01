import { and, count, eq, gte, sql } from 'drizzle-orm';
import { db } from './index.js';
import { consultas, usuarios } from './schema.js';

const LIMITES_POR_PLANO: Record<string, number | null> = {
  free: 50,
  pro: 10000,
  enterprise: null,
};

export interface ContaResumo {
  id: string;
  nome: string;
  email: string;
  plano: string;
  limiteMensal: number | null;
  usoMensal: number;
  restanteMensal: number | null;
}

function inicioDoMesAtual(): Date {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
}

export async function obterContaPorApiKey(apiKey: string): Promise<ContaResumo | null> {
  const usuario = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.apiKey, apiKey))
    .limit(1);

  if (usuario.length === 0) return null;

  const u = usuario[0];
  const [uso] = await db
    .select({ total: count() })
    .from(consultas)
    .where(and(eq(consultas.usuarioId, u.id), gte(consultas.criadoEm, inicioDoMesAtual())));

  const limiteMensal = LIMITES_POR_PLANO[u.plano] ?? LIMITES_POR_PLANO.free;
  const usoMensal = Number(uso?.total || 0);

  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    plano: u.plano,
    limiteMensal,
    usoMensal,
    restanteMensal: limiteMensal === null ? null : Math.max(0, limiteMensal - usoMensal),
  };
}
