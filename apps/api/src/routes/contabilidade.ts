import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { encontrarUsuarioPorApiKey } from '../db/auth.js';
import { documentos } from '../db/schema.js';
import {
  criarPacoteXmlMensal,
  enviarPacoteXmlMensal,
  enviarXmlContabilidadeAutomatico,
  obterDocumentosXmlMes,
  obterEmailContabilidade,
  normalizarMesPacote,
} from '../utils/contabilidade.js';
import { enviarEmailComAnexo } from '../utils/mailer.js';

function extrairToken(authorization?: string, apiKey?: string): string | null {
  const headerValue = authorization || apiKey || '';
  if (!headerValue) return null;
  const bearerMatch = headerValue.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) return bearerMatch[1].trim();
  return headerValue.trim();
}

const schema = z.object({
  chave: z.string().min(44),
  email: z.string().email().optional(),
});

const pacoteSchema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  incluirEntradas: z.boolean().optional(),
  email: z.string().email().optional(),
});

export async function contabilidadeRoutes(app: FastifyInstance) {
  app.post('/xml', async (request, reply) => {
    const token = extrairToken(request.headers.authorization, request.headers['x-api-key']?.toString());
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida' });

    const body = schema.parse(request.body);
    const destino = body.email || obterEmailContabilidade(usuario.preferencias) || null;
    if (!destino) {
      return reply.status(400).send({ sucesso: false, erro: 'Informe o e-mail da contabilidade nas preferencias ou no envio.' });
    }

    const docs = await db.select().from(documentos).where(eq(documentos.chaveAcesso, body.chave)).limit(1);
    const doc = docs[0];
    if (!doc || !doc.xmlCompleto) {
      return reply.status(404).send({ sucesso: false, erro: 'XML nao encontrado no banco.' });
    }

    const xml = typeof doc.xmlCompleto === 'string' ? doc.xmlCompleto : JSON.stringify(doc.xmlCompleto, null, 2);
    await enviarEmailComAnexo({
      to: destino,
      subject: `XML fiscal ${doc.chaveAcesso}`,
      text: `Segue em anexo o XML fiscal da chave ${doc.chaveAcesso}.`,
      html: `<p>Segue em anexo o XML fiscal da chave <strong>${doc.chaveAcesso}</strong>.</p>`,
      attachments: [
        {
          filename: `xml-${doc.chaveAcesso}.xml`,
          content: xml,
          contentType: 'application/xml',
        },
      ],
    });

    return { sucesso: true, dados: { enviado: true, email: destino } };
  });

  app.post('/pacote-mensal', async (request, reply) => {
    const token = extrairToken(request.headers.authorization, request.headers['x-api-key']?.toString());
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida' });

    const body = pacoteSchema.parse(request.body);
    const mes = normalizarMesPacote(body.mes);
    const incluirEntradas = Boolean(body.incluirEntradas);
    const destino = body.email || obterEmailContabilidade(usuario.preferencias) || null;
    if (!destino) {
      return reply.status(400).send({ sucesso: false, erro: 'Informe o e-mail da contabilidade nas preferencias ou no envio.' });
    }

    const documentosMes = await obterDocumentosXmlMes(usuario.id, mes, incluirEntradas);
    if (documentosMes.length === 0) {
      return reply.status(404).send({ sucesso: false, erro: 'Nao ha XMLs disponiveis para o mes informado.' });
    }

    const pacote = await enviarPacoteXmlMensal({
      usuarioId: usuario.id,
      to: destino,
      mes,
      incluirEntradas,
      documentos: documentosMes,
    });

    return {
      sucesso: true,
      dados: {
        enviado: true,
        email: destino,
        mes,
        incluirEntradas,
        arquivo: pacote.nomeArquivo,
        total: pacote.total,
      },
    };
  });

  app.post('/pacote-mensal/arquivo', async (request, reply) => {
    const token = extrairToken(request.headers.authorization, request.headers['x-api-key']?.toString());
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida' });

    const body = pacoteSchema.parse(request.body);
    const mes = normalizarMesPacote(body.mes);
    const incluirEntradas = Boolean(body.incluirEntradas);
    const documentosMes = await obterDocumentosXmlMes(usuario.id, mes, incluirEntradas);
    if (documentosMes.length === 0) {
      return reply.status(404).send({ sucesso: false, erro: 'Nao ha XMLs disponiveis para o mes informado.' });
    }

    const pacote = await criarPacoteXmlMensal({ mes, incluirEntradas, documentos: documentosMes });
    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="${pacote.nomeArquivo}"`)
      .send(pacote.buffer);
  });
}
