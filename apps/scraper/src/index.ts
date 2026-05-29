import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { scrapeNFeporChave } from './scraper.js';

const PORT = Number(process.env.SCRAPER_PORT || 3100);
const ANTICAPTCHA_KEY = process.env.ANTICAPTCHA_KEY || '';

interface ScrapeRequest {
  chaveAcesso: string;
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

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.url === '/health' && req.method === 'GET') {
    sendJson(res, 200, { status: 'ok', service: 'scraper' });
    return;
  }

  if (req.url === '/scrape' && req.method === 'POST') {
    try {
      const body: ScrapeRequest = await parseBody(req);
      const { chaveAcesso } = body;

      if (!chaveAcesso || !/^\d{44}$/.test(chaveAcesso.replace(/\s/g, ''))) {
        sendJson(res, 400, { sucesso: false, erro: 'Chave de acesso invalida' });
        return;
      }

      const cleanChave = chaveAcesso.replace(/\s/g, '');
      console.log(`[scraper] Consultando chave ${cleanChave}`);

      const resultado = await scrapeNFeporChave(cleanChave, {
        anticaptcha: ANTICAPTCHA_KEY ? { apiKey: ANTICAPTCHA_KEY } : undefined,
        timeout: 60000,
      });

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
    console.log(`[scraper] Anti-Captacha configurado`);
  } else {
    console.log(`[scraper] ATENCAO: Anti-Captacha nao configurado (ANTICAPTCHA_KEY)`);
  }
});
