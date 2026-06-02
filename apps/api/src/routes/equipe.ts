import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { enviarEmail } from '../utils/mailer.js';
import { criarConviteEmpresa, listarConvitesEmpresa, listarMembrosEmpresa, aceitarConviteEmpresa, revogarConviteEmpresa } from '../db/equipe.js';
import { encontrarUsuarioPorApiKey, obterEmpresaAtiva } from '../db/auth.js';

function extrairToken(authorization?: string, apiKey?: string): string | null {
  const headerValue = authorization || apiKey || '';
  if (!headerValue) return null;
  const bearerMatch = headerValue.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) return bearerMatch[1].trim();
  return headerValue.trim();
}

function baseWebUrl(): string {
  return process.env.WEB_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:3003';
}

function normalizarCnpj(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, 14);
}

const conviteSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  papel: z.enum(['membro', 'contabilidade', 'admin']).optional(),
  cnpj: z.string().optional(),
});

const aceitarSchema = z.object({
  token: z.string().min(16),
});

export async function equipeRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const token = extrairToken(request.headers.authorization, request.headers['x-api-key']?.toString());
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida' });

    const cnpjAtivo = normalizarCnpj((request.query as { cnpj?: string }).cnpj || (await obterEmpresaAtiva(usuario.id)) || usuario.cnpj || '');
    if (cnpjAtivo.length !== 14) {
      return { sucesso: true, dados: { membros: [], convites: [], cnpjAtivo: null } };
    }

    const [membros, convites] = await Promise.all([
      listarMembrosEmpresa(cnpjAtivo),
      listarConvitesEmpresa(cnpjAtivo),
    ]);

    return { sucesso: true, dados: { membros, convites, cnpjAtivo } };
  });

  app.post('/convites', async (request, reply) => {
    const token = extrairToken(request.headers.authorization, request.headers['x-api-key']?.toString());
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida' });

    const body = conviteSchema.parse(request.body);
    const cnpj = normalizarCnpj(body.cnpj || (await obterEmpresaAtiva(usuario.id)) || usuario.cnpj || '');
    if (cnpj.length !== 14) return reply.status(400).send({ sucesso: false, erro: 'CNPJ ativo invalido.' });

    const convite = await criarConviteEmpresa({
      usuarioId: usuario.id,
      cnpj,
      nome: body.nome,
      email: body.email,
      papel: body.papel || 'membro',
    });

    const aceitarUrl = `${baseWebUrl()}/empresa/aceitar?token=${encodeURIComponent(convite.token)}`;
    await enviarEmail({
      to: convite.email,
      subject: 'Convite de acesso DFeCentral',
      text: `Você foi convidado para acessar a empresa em DFeCentral. Acesse: ${aceitarUrl}`,
      html: `<p>Você foi convidado para acessar a empresa em DFeCentral.</p><p><a href="${aceitarUrl}">Aceitar convite</a></p>`,
    });

    return { sucesso: true, dados: { convite } };
  });

  app.post('/aceitar', async (request, reply) => {
    const tokenAuth = extrairToken(request.headers.authorization, request.headers['x-api-key']?.toString());
    if (!tokenAuth) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida' });

    const usuario = await encontrarUsuarioPorApiKey(tokenAuth);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida' });

    const body = aceitarSchema.parse(request.body);
    const aceite = await aceitarConviteEmpresa({ usuarioId: usuario.id, token: body.token });
    if (!aceite) {
      return reply.status(400).send({ sucesso: false, erro: 'Convite invalido ou e-mail nao confere.' });
    }

    return { sucesso: true, dados: aceite };
  });

  app.delete('/convites/:id', async (request, reply) => {
    const token = extrairToken(request.headers.authorization, request.headers['x-api-key']?.toString());
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida' });

    const { id } = request.params as { id: string };
    const removido = await revogarConviteEmpresa({ usuarioId: usuario.id, conviteId: id });
    if (!removido) return reply.status(404).send({ sucesso: false, erro: 'Convite nao encontrado.' });
    return { sucesso: true };
  });
}
