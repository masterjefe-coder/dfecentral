import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  atualizarSenhaUsuario,
  atualizarPerfilUsuario,
  atualizarPreferenciasUsuario,
  criarUsuario,
  encontrarUsuarioPorApiKey,
  encontrarUsuarioPorEmail,
  obterPreferenciasUsuario,
  garantirUsuarioGoogle,
  verificarSenha,
} from '../db/auth.js';
import { enviarEmail, temSMTPConfigurado } from '../utils/mailer.js';

const cadastroSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  senha: z.string().min(6),
  cnpj: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(6),
});

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  token: z.string().min(16),
  senha: z.string().min(6),
});

const perfilSchema = z.object({
  nome: z.string().min(2).optional(),
  cnpj: z.string().optional().nullable(),
});

const preferenciasSchema = z.object({
  cnpjPadrao: z.string().optional().nullable(),
  cnpjAtivo: z.string().optional().nullable(),
  movimentoPadrao: z.enum(['todas', 'emitidas', 'recebidas']).optional(),
  tipoPadrao: z.enum(['nfe', 'nfce', 'cte', 'mdfe', 'bpe', 'cteos', 'nfse', 'dce']).optional(),
  inicioPadrao: z.string().optional().nullable(),
  fimPadrao: z.string().optional().nullable(),
  contabilidadeEmail: z.string().email().optional().nullable(),
  contabilidadeEnvioAutomatico: z.boolean().optional(),
});

function segredoAuth(): string {
  return process.env.AUTH_SECRET || process.env.API_KEY || 'dfecentral-auth-secret';
}

type RequestLike = {
  headers: {
    host?: string | string[];
    'x-forwarded-host'?: string | string[];
    'x-forwarded-proto'?: string | string[];
  };
  protocol?: string;
};

function primeiroCabecalho(valor: string | string[] | undefined): string | undefined {
  if (!valor) return undefined;
  return Array.isArray(valor) ? valor[0]?.trim() || undefined : valor.trim() || undefined;
}

function ajustarSubdominio(urlBase: string, subdominio: 'www' | 'api'): string {
  try {
    const url = new URL(urlBase);
    const partes = url.hostname.split('.');
    if (partes.length >= 3 && partes[1] === 'dfecentral' && partes[2] === 'com') {
      partes[0] = subdominio;
      url.hostname = partes.join('.');
      return url.toString().replace(/\/$/, '');
    }
  } catch {
    // Mantem o fallback abaixo.
  }
  return urlBase;
}

function baseWebUrl(request?: RequestLike): string {
  const configurado = process.env.WEB_BASE_URL || process.env.APP_BASE_URL;
  if (configurado) return configurado;

  if (request) {
    const proto = primeiroCabecalho(request.headers['x-forwarded-proto']) || request.protocol || 'http';
    const host = primeiroCabecalho(request.headers['x-forwarded-host']) || primeiroCabecalho(request.headers.host);
    if (host && host.endsWith('dfecentral.com.br')) {
      return ajustarSubdominio(`${proto}://${host}`, 'www');
    }
  }

  return 'http://localhost:3003';
}

function baseApiUrl(request?: RequestLike): string {
  const configurado = process.env.API_PUBLIC_URL;
  if (configurado) return configurado;

  if (request) {
    const proto = primeiroCabecalho(request.headers['x-forwarded-proto']) || request.protocol || 'http';
    const host = primeiroCabecalho(request.headers['x-forwarded-host']) || primeiroCabecalho(request.headers.host);
    if (host && host.endsWith('dfecentral.com.br')) {
      return ajustarSubdominio(`${proto}://${host}`, 'api');
    }
  }

  return 'http://127.0.0.1:3004';
}

function normalizarRedirect(valor: string | undefined, request?: RequestLike): string {
  const base = new URL(baseWebUrl(request));
  try {
    const destino = new URL(valor || '/dashboard', base);
    if (destino.origin !== base.origin) return `${base.origin}/dashboard`;
    return destino.toString();
  } catch {
    return `${base.origin}/dashboard`;
  }
}

function respostaUsuario(usuario: Awaited<ReturnType<typeof criarUsuario>>) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    plano: usuario.plano,
    apiKey: usuario.apiKey,
  };
}

function criarTokenRedefinicao(usuarioId: string): string {
  const exp = Date.now() + 1000 * 60 * 60 * 24;
  const payload = Buffer.from(JSON.stringify({ usuarioId, exp }), 'utf8').toString('base64url');
  const assinatura = createHash('sha256').update(`${payload}.${segredoAuth()}`).digest('base64url');
  return `${payload}.${assinatura}`;
}

function validarTokenRedefinicao(token: string): string | null {
  const [payload, assinatura] = token.split('.');
  if (!payload || !assinatura) return null;

  const esperado = createHash('sha256').update(`${payload}.${segredoAuth()}`).digest('base64url');
  if (esperado !== assinatura) return null;

  try {
    const dados = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { usuarioId?: string; exp?: number };
    if (!dados.usuarioId || !dados.exp || Date.now() > dados.exp) return null;
    return dados.usuarioId;
  } catch {
    return null;
  }
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/registrar', async (request, reply) => {
    const body = cadastroSchema.parse(request.body);
    const existente = await encontrarUsuarioPorEmail(body.email);
    if (existente) {
      return reply.status(409).send({ sucesso: false, erro: 'E-mail ja cadastrado.' });
    }

    const usuario = await criarUsuario(body);
    return {
      sucesso: true,
      dados: { usuario: respostaUsuario(usuario) },
    };
  });

  app.post('/entrar', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const usuario = await encontrarUsuarioPorEmail(body.email);
    if (!usuario || !verificarSenha(body.senha, usuario.senhaHash)) {
      return reply.status(401).send({ sucesso: false, erro: 'Credenciais invalidas.' });
    }

    return {
      sucesso: true,
      dados: { usuario: respostaUsuario(usuario) },
    };
  });

  app.post('/esqueci-senha', async (request) => {
    const body = forgotSchema.parse(request.body);
    const usuario = await encontrarUsuarioPorEmail(body.email);
    if (!usuario) {
      return { sucesso: true, dados: { enviado: true } };
    }

    const token = criarTokenRedefinicao(usuario.id);
    const url = `${baseWebUrl(request)}/auth/redefinir?token=${encodeURIComponent(token)}`;
    if (temSMTPConfigurado()) {
      await enviarEmail({
        to: usuario.email,
        subject: 'DFeCentral - redefinição de senha',
        text: `Olá,\n\nPara redefinir sua senha, acesse: ${url}\n\nSe não foi você, ignore este e-mail.`,
        html: `<p>Olá,</p><p>Para redefinir sua senha, acesse:</p><p><a href="${url}">${url}</a></p><p>Se não foi você, ignore este e-mail.</p>`,
      });
    }
    return {
      sucesso: true,
      dados: {
        enviado: true,
        recuperacaoUrl: process.env.NODE_ENV === 'production' ? undefined : url,
      },
    };
  });

  app.post('/redefinir', async (request, reply) => {
    const body = resetSchema.parse(request.body);
    const usuarioId = validarTokenRedefinicao(body.token);
    if (!usuarioId) {
      return reply.status(400).send({ sucesso: false, erro: 'Token invalido ou expirado.' });
    }

    await atualizarSenhaUsuario(usuarioId, body.senha);
    return { sucesso: true, dados: { atualizado: true } };
  });

  app.get('/me', async (request, reply) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || request.headers['x-api-key']?.toString()?.trim();
    if (!token) {
      return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida.' });
    }

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) {
      return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida.' });
    }

    return { sucesso: true, dados: { usuario: respostaUsuario(usuario) } };
  });

  app.patch('/me', async (request, reply) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || request.headers['x-api-key']?.toString()?.trim();
    if (!token) {
      return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida.' });
    }

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) {
      return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida.' });
    }

    const body = perfilSchema.parse(request.body);
    const atualizado = await atualizarPerfilUsuario(usuario.id, body);
    if (!atualizado) {
      return reply.status(404).send({ sucesso: false, erro: 'Usuario nao encontrado.' });
    }

    return { sucesso: true, dados: { usuario: respostaUsuario(atualizado) } };
  });

  app.get('/prefs', async (request, reply) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || request.headers['x-api-key']?.toString()?.trim();
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida.' });
    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida.' });
    return { sucesso: true, dados: { preferencias: await obterPreferenciasUsuario(usuario.id) } };
  });

  app.patch('/prefs', async (request, reply) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || request.headers['x-api-key']?.toString()?.trim();
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida.' });
    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida.' });

    const body = preferenciasSchema.parse(request.body);
    const preferenciasAtuais = await obterPreferenciasUsuario(usuario.id);
    const atualizadas = { ...preferenciasAtuais, ...body };
    await atualizarPreferenciasUsuario(usuario.id, atualizadas);
    return { sucesso: true, dados: { preferencias: atualizadas } };
  });

  app.get('/google/iniciar', async (request, reply) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirect = normalizarRedirect((request.query as Record<string, string | undefined>).redirect, request);
    if (!clientId || !clientSecret) {
      return reply.redirect(`${baseWebUrl(request)}/auth/entrar?erro=google_indisponivel`);
    }

    const state = Buffer.from(JSON.stringify({ redirect }), 'utf8').toString('base64url');
    const callbackUrl = `${baseApiUrl(request)}/api/v1/auth/google/callback`;
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', callbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('prompt', 'select_account');
    url.searchParams.set('state', state);
    return reply.redirect(url.toString());
  });

  app.get('/google/callback', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const code = query.code;
    const state = query.state;
    if (!code || !state) {
      return reply.redirect(`${baseWebUrl(request)}/auth/entrar?erro=google_invalido`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${baseApiUrl(request)}/api/v1/auth/google/callback`;
    if (!clientId || !clientSecret) {
      return reply.redirect(`${baseWebUrl(request)}/auth/entrar?erro=google_indisponivel`);
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      return reply.redirect(`${baseWebUrl(request)}/auth/entrar?erro=google_token`);
    }

    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      return reply.redirect(`${baseWebUrl(request)}/auth/entrar?erro=google_token`);
    }

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileResponse.ok) {
      return reply.redirect(`${baseWebUrl(request)}/auth/entrar?erro=google_profile`);
    }

    const claims = (await profileResponse.json()) as { email?: string; name?: string };
    if (!claims.email) {
      return reply.redirect(`${baseWebUrl(request)}/auth/entrar?erro=google_email`);
    }

    const usuario = await garantirUsuarioGoogle({
      email: claims.email,
      nome: claims.name || claims.email.split('@')[0] || 'Usuario Google',
    });
    if (!usuario.apiKey) {
      return reply.redirect(`${baseWebUrl(request)}/auth/entrar?erro=google_key`);
    }

    const payload = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as { redirect?: string };
    const destino = normalizarRedirect(payload.redirect);
    const separador = destino.includes('?') ? '&' : '?';
    return reply.redirect(`${destino}${separador}apiKey=${encodeURIComponent(usuario.apiKey)}`);
  });
}
