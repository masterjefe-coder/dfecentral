import type { FastifyInstance } from 'fastify';
import { and, desc, eq, gte, lte, or, sql } from 'drizzle-orm';
import { chromium } from 'playwright';
import { db } from '../db/index.js';
import { documentos } from '../db/schema.js';

type Movimento = 'emitidas' | 'recebidas' | 'todas';

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

async function carregarRelatorio(cnpj: string, tipo: string, movimento: Movimento, inicio?: string, fim?: string) {
  const inicioDate = parseDate(inicio);
  const fimDate = parseDate(fim);
  const conditions = [eq(documentos.tipo, tipo as any)];
  if (movimento === 'emitidas') conditions.push(eq(documentos.cnpjEmitente, cnpj));
  else if (movimento === 'recebidas') conditions.push(eq(documentos.cnpjDestinatario, cnpj));
  else conditions.push(or(eq(documentos.cnpjEmitente, cnpj), eq(documentos.cnpjDestinatario, cnpj)) as any);
  if (inicioDate) conditions.push(gte(documentos.dataEmissao, inicioDate));
  if (fimDate) conditions.push(lte(documentos.dataEmissao, fimDate));

  const documentosLista = await db
    .select()
    .from(documentos)
    .where(and(...conditions))
    .orderBy(desc(documentos.dataEmissao))
    .limit(100);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(documentos)
    .where(and(...conditions));

  const emitidas = documentosLista.filter((doc) => doc.cnpjEmitente === cnpj);
  const recebidas = documentosLista.filter((doc) => doc.cnpjDestinatario === cnpj);
  const porTipo = ['nfe', 'nfce', 'cte', 'mdfe', 'bpe', 'cteos', 'nfse', 'dce'].map((item) => {
    const docsTipo = documentosLista.filter((doc) => doc.tipo === item);
    return {
      tipo: item.toUpperCase(),
      total: docsTipo.length,
      emitidas: docsTipo.filter((doc) => doc.cnpjEmitente === cnpj).length,
      recebidas: docsTipo.filter((doc) => doc.cnpjDestinatario === cnpj).length,
    };
  });

  return { total: Number(count), documentosLista, emitidas, recebidas, porTipo };
}

function renderHtml({
  cnpj,
  movimento,
  tipo,
  inicio,
  fim,
  total,
  documentosLista,
}: {
  cnpj: string;
  movimento: Movimento;
  tipo: string;
  inicio?: string;
  fim?: string;
  total: number;
  documentosLista: Array<typeof documentos.$inferSelect>;
}): string {
  const emitidas = documentosLista.filter((doc) => doc.cnpjEmitente === cnpj);
  const recebidas = documentosLista.filter((doc) => doc.cnpjDestinatario === cnpj);
  const tipoRows = ['nfe', 'nfce', 'cte', 'mdfe', 'bpe', 'cteos', 'nfse', 'dce'].map((item) => {
    const docsTipo = documentosLista.filter((doc) => doc.tipo === item);
    return {
      tipo: item.toUpperCase(),
      total: docsTipo.length,
      emitidas: docsTipo.filter((doc) => doc.cnpjEmitente === cnpj).length,
      recebidas: docsTipo.filter((doc) => doc.cnpjDestinatario === cnpj).length,
    };
  });
  const rows = documentosLista
    .map(
      (doc) => `
        <tr>
          <td>${escapeHtml(doc.tipo.toUpperCase())}</td>
          <td>${escapeHtml(doc.numero)}</td>
          <td>${escapeHtml(formatDate(doc.dataEmissao.toISOString()))}</td>
          <td>${escapeHtml(doc.cnpjEmitente)}</td>
          <td>${escapeHtml(doc.cnpjDestinatario || '-')}</td>
          <td>${escapeHtml(String(doc.valorTotal || '-'))}</td>
          <td>${escapeHtml(doc.status)}</td>
        </tr>`,
    )
    .join('');

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Relatorio DFeCentral</title>
        <style>
          @page { size: A4; margin: 12mm; }
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #0f172a; background: #fff; }
          .header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px; }
          .title { font-size: 22px; font-weight: 700; margin: 0; }
          .sub { margin: 4px 0 0; color: #475569; font-size: 11px; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
          .card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; }
          .label { font-size: 9px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; }
          .value { margin-top: 4px; font-size: 13px; font-weight: 700; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th, td { border: 1px solid #e2e8f0; padding: 7px 8px; text-align: left; vertical-align: top; }
          th { background: #f8fafc; font-size: 9px; text-transform: uppercase; letter-spacing: .08em; }
          .footer { margin-top: 10px; color: #64748b; font-size: 9px; }
          .mono { font-family: Consolas, Monaco, monospace; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">Relatório fiscal</h1>
            <p class="sub">DFeCentral - ${escapeHtml(tipo.toUpperCase())} - ${escapeHtml(movimento)}</p>
          </div>
          <div style="text-align:right; font-size:11px; color:#475569;">
            <div><strong>CNPJ:</strong> ${escapeHtml(cnpj)}</div>
            <div><strong>Período:</strong> ${escapeHtml(inicio || '-')} até ${escapeHtml(fim || '-')}</div>
          </div>
        </div>

        <div class="grid">
          <div class="card"><div class="label">Total de documentos</div><div class="value">${total}</div></div>
          <div class="card"><div class="label">Emitidas</div><div class="value">${emitidas.length}</div></div>
          <div class="card"><div class="label">Recebidas</div><div class="value">${recebidas.length}</div></div>
          <div class="card"><div class="label">Tipo</div><div class="value">${escapeHtml(tipo.toUpperCase())}</div></div>
          <div class="card"><div class="label">Movimento</div><div class="value">${escapeHtml(movimento)}</div></div>
          <div class="card"><div class="label">Gerado em</div><div class="value">${escapeHtml(new Date().toLocaleString('pt-BR'))}</div></div>
        </div>

        <table style="margin-bottom:12px;">
          <thead>
            <tr><th>Tipo</th><th>Total</th><th>Emitidas</th><th>Recebidas</th></tr>
          </thead>
          <tbody>
            ${tipoRows.map((row) => `<tr><td>${row.tipo}</td><td>${row.total}</td><td>${row.emitidas}</td><td>${row.recebidas}</td></tr>`).join('')}
          </tbody>
        </table>

        <table>
          <thead>
            <tr>
              <th>Tipo</th><th>Número</th><th>Data</th><th>Emitente</th><th>Destinatário</th><th>Valor</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="7">Sem documentos no período.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">PDF gerado automaticamente pela DFeCentral.</div>
      </body>
    </html>
  `;
}

export async function relatoriosRoutes(app: FastifyInstance) {
  app.get('/dados', async (request, reply) => {
    const { cnpj, tipo = 'nfe', movimento = 'todas', inicio, fim } = request.query as Record<string, string | undefined>;
    const cnpjLimpo = String(cnpj || '').replace(/\D/g, '').slice(0, 14);
    const movimentoValido: Movimento = movimento === 'emitidas' || movimento === 'recebidas' ? movimento : 'todas';
    const tipoValido = String(tipo || 'nfe').toLowerCase();

    if (!/^[0-9]{14}$/.test(cnpjLimpo)) {
      return reply.status(400).send({ sucesso: false, erro: 'CNPJ invalido' });
    }

    const relatorio = await carregarRelatorio(cnpjLimpo, tipoValido, movimentoValido, inicio, fim);
    return {
      sucesso: true,
      dados: {
        cnpj: cnpjLimpo,
        tipo: tipoValido,
        movimento: movimentoValido,
        inicio: inicio || null,
        fim: fim || null,
        total: relatorio.total,
        emitidas: relatorio.emitidas.length,
        recebidas: relatorio.recebidas.length,
        porTipo: relatorio.porTipo,
        documentos: relatorio.documentosLista.slice(0, 100),
      },
    };
  });

  app.get('/pdf', async (request, reply) => {
    const { cnpj, tipo = 'nfe', movimento = 'todas', inicio, fim } = request.query as Record<string, string | undefined>;
    const cnpjLimpo = String(cnpj || '').replace(/\D/g, '').slice(0, 14);
    const movimentoValido: Movimento = movimento === 'emitidas' || movimento === 'recebidas' ? movimento : 'todas';
    const tipoValido = String(tipo || 'nfe').toLowerCase();

    if (!/^[0-9]{14}$/.test(cnpjLimpo)) {
      return reply.status(400).send({ sucesso: false, erro: 'CNPJ invalido' });
    }

    const relatorio = await carregarRelatorio(cnpjLimpo, tipoValido, movimentoValido, inicio, fim);

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    try {
      const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
      await page.setContent(
        renderHtml({
          cnpj: cnpjLimpo,
          tipo: tipoValido,
          movimento: movimentoValido,
          inicio,
          fim,
          total: relatorio.total,
          documentosLista: relatorio.documentosLista,
        }),
        { waitUntil: 'load' },
      );
      await page.emulateMedia({ media: 'screen' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });

      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `inline; filename="relatorio-${tipoValido}-${cnpjLimpo}.pdf"`)
        .send(Buffer.from(pdf));
    } finally {
      await browser.close().catch(() => {});
    }
  });
}
