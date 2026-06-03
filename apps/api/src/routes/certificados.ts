import type { FastifyInstance } from 'fastify';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { carregarCertificado } from '@dfecentral/sdk';
import { encontrarUsuarioPorApiKey, obterEmpresaAtiva } from '../db/auth.js';
import { obterCertificadoDigitalUsuario, removerCertificadoDigital, salvarCertificadoDigital } from '../db/certificados.js';

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

function decodificarArquivoBase64(valor: string): Buffer {
  const base64 = valor.includes(',') ? valor.split(',').pop() || '' : valor;
  return Buffer.from(base64, 'base64');
}

export async function certificadosRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const token = extrairToken(request.headers.authorization, request.headers['x-api-key']?.toString());
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida.' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida.' });

    const cnpj = normalizarCnpj((request.query as { cnpj?: string }).cnpj || (await obterEmpresaAtiva(usuario.id)) || usuario.cnpj || '');
    if (cnpj.length !== 14) {
      return { sucesso: true, dados: { certificado: null, cnpj: null } };
    }

    const certificado = await obterCertificadoDigitalUsuario(usuario.id, cnpj);
    if (!certificado) {
      return { sucesso: true, dados: { certificado: null, cnpj } };
    }

    return {
      sucesso: true,
      dados: {
        cnpj,
        certificado: {
          cnpj: certificado.cnpj,
          certificadoCnpj: certificado.certificadoCnpj,
          nomeArquivo: certificado.nomeArquivo,
          mimeType: certificado.mimeType,
          tamanhoBytes: certificado.tamanhoBytes,
          validadeEm: certificado.validadeEm,
          criadoEm: certificado.criadoEm,
          atualizadoEm: certificado.atualizadoEm,
        },
      },
    };
  });

  app.post('/', async (request, reply) => {
    const token = extrairToken(request.headers.authorization, request.headers['x-api-key']?.toString());
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida.' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida.' });

    const body = request.body as {
      cnpj?: string;
      senha?: string;
      arquivoBase64?: string;
      nomeArquivo?: string;
      mimeType?: string;
    };

    const cnpj = normalizarCnpj(body?.cnpj || (await obterEmpresaAtiva(usuario.id)) || usuario.cnpj || '');
    const senha = String(body?.senha || '').trim();
    const arquivoBase64 = String(body?.arquivoBase64 || '').trim();
    const nomeArquivo = String(body?.nomeArquivo || 'certificado.pfx').trim();
    const mimeType = String(body?.mimeType || 'application/x-pkcs12').trim() || 'application/x-pkcs12';

    if (cnpj.length !== 14) {
      return reply.status(400).send({ sucesso: false, erro: 'CNPJ ativo invalido.' });
    }
    if (!senha) {
      return reply.status(400).send({ sucesso: false, erro: 'Senha do certificado obrigatoria.' });
    }
    if (!arquivoBase64) {
      return reply.status(400).send({ sucesso: false, erro: 'Arquivo do certificado obrigatorio.' });
    }

    const arquivo = decodificarArquivoBase64(arquivoBase64);
    const tmpDir = mkdtempSync(join(tmpdir(), 'dfecentral-cert-upload-'));
    const caminho = join(tmpDir, nomeArquivo.endsWith('.pfx') ? nomeArquivo : `${nomeArquivo}.pfx`);

    try {
      writeFileSync(caminho, arquivo);
      const certificado = carregarCertificado(caminho, senha);

      if (certificado.cnpj !== cnpj) {
        return reply.status(400).send({
          sucesso: false,
          erro: `O CNPJ do certificado (${certificado.cnpj}) nao confere com o CNPJ ativo (${cnpj}).`,
        });
      }

      const salvo = await salvarCertificadoDigital({
        usuarioId: usuario.id,
        cnpj,
        certificadoCnpj: certificado.cnpj,
        nomeArquivo,
        mimeType,
        tamanhoBytes: arquivo.length,
        validadeEm: certificado.validoAte,
        arquivo,
        senha,
      });

      return {
        sucesso: true,
        dados: {
          cnpj,
          certificado: {
            cnpj: salvo.cnpj,
            certificadoCnpj: salvo.certificadoCnpj,
            nomeArquivo: salvo.nomeArquivo,
            mimeType: salvo.mimeType,
            tamanhoBytes: salvo.tamanhoBytes,
            validadeEm: salvo.validadeEm,
            criadoEm: salvo.criadoEm,
            atualizadoEm: salvo.atualizadoEm,
          },
        },
      };
    } catch (error: any) {
      return reply.status(400).send({ sucesso: false, erro: error?.message || 'Nao foi possivel salvar o certificado.' });
    } finally {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  app.delete('/', async (request, reply) => {
    const token = extrairToken(request.headers.authorization, request.headers['x-api-key']?.toString());
    if (!token) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao requerida.' });

    const usuario = await encontrarUsuarioPorApiKey(token);
    if (!usuario) return reply.status(401).send({ sucesso: false, erro: 'Autenticacao invalida.' });

    const cnpj = normalizarCnpj((request.query as { cnpj?: string }).cnpj || (await obterEmpresaAtiva(usuario.id)) || usuario.cnpj || '');
    if (cnpj.length !== 14) {
      return reply.status(400).send({ sucesso: false, erro: 'CNPJ ativo invalido.' });
    }

    const removido = await removerCertificadoDigital(usuario.id, cnpj);
    if (!removido) {
      return reply.status(404).send({ sucesso: false, erro: 'Certificado nao encontrado.' });
    }

    return { sucesso: true };
  });
}
