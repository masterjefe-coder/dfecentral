import { and, desc, eq, like } from 'drizzle-orm';
import { db } from './index.js';
import { consultas } from './schema.js';

export interface RegistroConsulta {
  usuarioId?: string | null;
  tipo: string;
  consulta: string;
  resultado: string;
  ip?: string | null;
}

export async function registrarConsulta(registro: RegistroConsulta): Promise<void> {
  try {
    await db.insert(consultas).values({
      usuarioId: registro.usuarioId || null,
      tipo: registro.tipo,
      consulta: registro.consulta,
      resultado: registro.resultado,
      ip: registro.ip || null,
    });
  } catch {
    // auditoria nao pode derrubar o fluxo principal
  }
}

export async function listarConsultasRecentes(usuarioId?: string, cnpj?: string, limite = 12) {
  if (!usuarioId) return [];

  const filtros = [eq(consultas.usuarioId, usuarioId), like(consultas.tipo, 'importacao:%')];
  if (cnpj) filtros.push(eq(consultas.consulta, cnpj));

  const query = db
    .select()
    .from(consultas)
    .where(and(...filtros))
    .orderBy(desc(consultas.criadoEm))
    .limit(Math.min(100, Math.max(1, limite)));

  return query;
}
