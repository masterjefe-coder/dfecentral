import { and, count, eq, gte, sql } from 'drizzle-orm';
import { db } from './index.js';
import { consultas, usuarios } from './schema.js';

const LIMITES_POR_PLANO: Record<string, number | null> = {
  free: 50,
  starter: 500,
  pro: 10000,
  enterprise: null,
};

export interface ContaResumo {
  id: string;
  nome: string;
  email: string;
  plano: string;
  assinaturaStatus: string;
  assinaturaCancelEm: string | null;
  assinaturaRenovaEm: string | null;
  limiteMensal: number | null;
  usoMensal: number;
  restanteMensal: number | null;
}

function inicioDoMesAtual(): Date {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
}

function dataISO(valor?: Date | string | null): string | null {
  if (!valor) return null;
  const date = typeof valor === 'string' ? new Date(valor) : valor;
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function planoEfetivo(usuario: { plano: string; assinaturaStatus: string; assinaturaCancelEm?: Date | string | null }): string {
  const cancelEm = usuario.assinaturaCancelEm ? new Date(usuario.assinaturaCancelEm) : null;
  if (usuario.assinaturaStatus === 'cancelada' && cancelEm && Date.now() >= cancelEm.getTime()) {
    return 'free';
  }

  return usuario.plano || 'free';
}

export async function obterContaPorApiKey(apiKey: string): Promise<ContaResumo | null> {
  const usuario = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.apiKey, apiKey))
    .limit(1);

  if (usuario.length === 0) return null;

  const u = usuario[0];
  const plano = planoEfetivo(u as any);
  const [uso] = await db
    .select({ total: count() })
    .from(consultas)
    .where(and(eq(consultas.usuarioId, u.id), gte(consultas.criadoEm, inicioDoMesAtual())));

  const limiteMensal = LIMITES_POR_PLANO[plano] ?? LIMITES_POR_PLANO.free;
  const usoMensal = Number(uso?.total || 0);

  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    plano,
    assinaturaStatus: u.assinaturaStatus,
    assinaturaCancelEm: dataISO(u.assinaturaCancelEm),
    assinaturaRenovaEm: dataISO(u.assinaturaRenovaEm),
    limiteMensal,
    usoMensal,
    restanteMensal: limiteMensal === null ? null : Math.max(0, limiteMensal - usoMensal),
  };
}
