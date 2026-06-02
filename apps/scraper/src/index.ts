import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { scrapeDocumentoPorChave } from './scraper.js';
import {
  abortAssistJob,
  finalizeAssistJob,
  getAssistJobFrame,
  getAssistJobState,
  performAssistAction,
  startAssistJob,
} from './assistido.js';

const PORT = Number(process.env.SCRAPER_PORT || 3100);
const ANTICAPTCHA_KEY = process.env.ANTICAPTCHA_KEY || '';

interface ScrapeRequest {
  chaveAcesso: string;
  tipo?: string;
}

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: { toString(): string }) => (body += chunk.toString()));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        console.error(`[scraper] Erro parse JSON. Body len=${body.length} raw="${body.slice(0, 200)}"`);
        reject(new Error('JSON invalido'));
      }
    });
    req.on('error', (err: Error) => reject(err));
  });
}

function sendJson(res: ServerResponse, status: number, data: any) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function sendBinary(res: ServerResponse, status: number, buffer: Buffer, contentType = 'application/octet-stream') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(buffer);
}

async function handleAssistRequest(req: IncomingMessage, res: ServerResponse, pathname: string) {
  if (req.method === 'POST' && pathname === '/assist/start') {
    try {
      const body = await parseBody(req);
      const chaveAcesso = String(body?.chaveAcesso || '').replace(/\s/g, '');

      if (!/^\d{44}$/.test(chaveAcesso)) {
        sendJson(res, 400, { sucesso: false, erro: 'Chave de acesso invalida' });
        return true;
      }

      const job = await startAssistJob(chaveAcesso);
      sendJson(res, 201, { sucesso: true, job });
    } catch (error: any) {
      console.error('[scraper] Erro ao iniciar consulta assistida:', error);
      sendJson(res, 500, { sucesso: false, erro: error?.message || 'Erro ao iniciar consulta assistida' });
    }
    return true;
  }

  const match = pathname.match(/^\/assist\/([^/]+)(?:\/([^/]+))?$/);
  if (!match) return false;

  const id = match[1];
  const resource = match[2] || 'state';

  if (req.method === 'GET' && resource === 'state') {
    const job = await getAssistJobState(id);
    if (!job) {
      sendJson(res, 404, { sucesso: false, erro: 'Job nao encontrado' });
      return true;
    }
    sendJson(res, 200, { sucesso: true, job });
    return true;
  }

  if (req.method === 'GET' && resource === 'frame') {
    const frame = await getAssistJobFrame(id);
    if (!frame) {
      sendJson(res, 404, { sucesso: false, erro: 'Frame nao disponivel' });
      return true;
    }
    sendBinary(res, 200, frame, 'image/png');
    return true;
  }

  if (req.method === 'POST' && resource === 'action') {
    try {
      const body = await parseBody(req);
      const job = await performAssistAction(id, body);
      if (!job) {
        sendJson(res, 404, { sucesso: false, erro: 'Job nao encontrado' });
        return true;
      }
      sendJson(res, 200, { sucesso: true, job });
    } catch (error: any) {
      console.error('[scraper] Erro ao executar acao assistida:', error);
      sendJson(res, 500, { sucesso: false, erro: error?.message || 'Erro ao executar acao' });
    }
    return true;
  }

  if (req.method === 'POST' && resource === 'finalizar') {
    try {
      const job = await finalizeAssistJob(id);
      if (!job) {
        sendJson(res, 404, { sucesso: false, erro: 'Job nao encontrado' });
        return true;
      }
      sendJson(res, 200, { sucesso: true, job });
    } catch (error: any) {
      console.error('[scraper] Erro ao finalizar consulta assistida:', error);
      sendJson(res, 500, { sucesso: false, erro: error?.message || 'Erro ao finalizar consulta' });
    }
    return true;
  }

  if (req.method === 'DELETE' && resource === 'state') {
    const ok = await abortAssistJob(id);
    if (!ok) {
      sendJson(res, 404, { sucesso: false, erro: 'Job nao encontrado' });
      return true;
    }
    sendJson(res, 200, { sucesso: true });
    return true;
  }

  sendJson(res, 405, { sucesso: false, erro: 'Metodo nao permitido' });
  return true;
}

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (pathname.startsWith('/assist')) {
    const handled = await handleAssistRequest(req, res, pathname);
    if (handled) return;
  }

  if (req.url === '/health' && req.method === 'GET') {
    sendJson(res, 200, { status: 'ok', service: 'scraper' });
    return;
  }

  if (req.url === '/scrape' && req.method === 'POST') {
    try {
      const body: ScrapeRequest = await parseBody(req);
      const { chaveAcesso } = body;
      const tipo = String(body?.tipo || '').trim();

      const cleanChave = chaveAcesso ? chaveAcesso.replace(/\s/g, '') : '';
      if (!cleanChave || (!/^\d{44}$/.test(cleanChave) && cleanChave.length !== 50 && cleanChave.length !== 56)) {
        sendJson(res, 400, { sucesso: false, erro: 'Chave de acesso invalida' });
        return;
      }

      console.log(`[scraper] Consultando chave ${cleanChave}`);

      const resultado = await scrapeDocumentoPorChave(cleanChave, {
        anticaptcha: ANTICAPTCHA_KEY ? { apiKey: ANTICAPTCHA_KEY } : undefined,
        timeout: 60000,
      }, tipo || undefined);

      sendJson(res, resultado.sucesso ? 200 : 404, resultado);
    } catch (error: any) {
      console.error('[scraper] Erro:', error);
      sendJson(res, 500, { sucesso: false, erro: error.message || 'Erro interno' });
    }
    return;
  }

  sendJson(res, 404, { sucesso: false, erro: 'Rota nao encontrada' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[scraper] Servidor rodando em http://127.0.0.1:${PORT}`);
  if (ANTICAPTCHA_KEY) {
    console.log(`[scraper] Anti-Captcha configurado`);
  } else {
    console.log(`[scraper] ATENCAO: Anti-Captcha nao configurado (ANTICAPTCHA_KEY)`);
  }
});
