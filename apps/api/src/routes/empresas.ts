import type { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { empresasUsuario } from '../db/schema.js';
import { atualizarEmpresaAtiva, encontrarUsuarioPorApiKey, obterEmpresaAtiva } from '../db/auth.js';

function extrairToken(authorization?: string, apiKey?: string): string | null {
  const headerValue = authorization || apiKey || '';
  if (!headerValue) return null;
  const bearerMatch = headerValue.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) return bearerMatch[1].trim();
  return headerValue.trim();
}

function normalizarCnpj(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, 14);
}

export async function empresasRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const token = extrairToken(request.headers.authorization, request.headers['x-api-key']?.toString());
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida' });

    const empresas = await db
      .select()
      .from(empresasUsuario)
      .where(eq(empresasUsuario.usuarioId, usuario.id))
      .orderBy(desc(empresasUsuario.criadoEm));

    return { sucesso: true, dados: { empresas } };
  });

  app.post('/', async (request, reply) => {
    const token = extrairToken(request.headers.authorization, request.headers['x-api-key']?.toString());
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida' });

    const body = request.body as { nome?: string; cnpj?: string };
    const nome = String(body?.nome || '').trim();
    const cnpj = normalizarCnpj(String(body?.cnpj || ''));
    if (!nome || cnpj.length !== 14) {
      return reply.status(400).send({ sucesso: false, erro: 'Nome e CNPJ validos sao obrigatorios' });
    }

    const [empresa] = await db
      .insert(empresasUsuario)
      .values({ usuarioId: usuario.id, nome, cnpj })
      .returning();

    return { sucesso: true, dados: { empresa } };
  });

  app.delete('/:id', async (request, reply) => {
    const token = extrairToken(request.headers.authorization, request.headers['x-api-key']?.toString());
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida' });

    const { id } = request.params as { id: string };
    const deletadas = await db.delete(empresasUsuario).where(and(eq(empresasUsuario.id, id), eq(empresasUsuario.usuarioId, usuario.id))).returning();
    if (deletadas[0]) {
      const cnpjAtivo = await obterEmpresaAtiva(usuario.id);
      if (cnpjAtivo && cnpjAtivo === deletadas[0].cnpj) {
        await atualizarEmpresaAtiva(usuario.id, null);
      }
    }
    return { sucesso: true };
  });

  app.get('/ativa', async (request, reply) => {
    const token = extrairToken(request.headers.authorization, request.headers['x-api-key']?.toString());
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida' });

    const cnpjAtivo = await obterEmpresaAtiva(usuario.id);
    return { sucesso: true, dados: { cnpjAtivo } };
  });

  app.patch('/ativa', async (request, reply) => {
    const token = extrairToken(request.headers.authorization, request.headers['x-api-key']?.toString());
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida' });

    const body = request.body as { cnpjAtivo?: string | null };
    const cnpjAtivo = String(body?.cnpjAtivo || '').replace(/\D/g, '').slice(0, 14);
    await atualizarEmpresaAtiva(usuario.id, cnpjAtivo || null);
    return { sucesso: true, dados: { cnpjAtivo: cnpjAtivo || null } };
  });
}
