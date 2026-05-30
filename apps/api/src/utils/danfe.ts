import { chromium } from 'playwright';
import type { DocumentoFiscal } from '@dfecentral/sdk';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function label(value: string | undefined): string {
  return value ? escapeHtml(value) : '-';
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

function renderHtml(documento: DocumentoFiscal): string {
  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>DANFE ${escapeHtml(documento.chaveAcesso)}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            background: #fff;
          }
          .page { border: 1px solid #cbd5e1; padding: 16px; }
          .header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 12px; }
          .title { font-size: 20px; font-weight: 700; margin: 0 0 6px; }
          .subtitle { font-size: 11px; color: #475569; margin: 0; }
          .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .row { font-size: 11px; line-height: 1.4; }
          .label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; margin-bottom: 2px; }
          .value { font-size: 12px; font-weight: 600; color: #0f172a; word-break: break-word; }
          .full { grid-column: 1 / -1; }
          .footer { margin-top: 12px; padding-top: 10px; border-top: 1px solid #cbd5e1; font-size: 10px; color: #64748b; }
          .chave { font-family: Consolas, Monaco, monospace; font-size: 10px; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div>
              <h1 class="title">DANFE</h1>
              <p class="subtitle">Documento Auxiliar da Nota Fiscal Eletronica</p>
            </div>
            <div class="row" style="text-align:right;">
              <span class="label">Status</span>
              <span class="value">${escapeHtml(documento.status.toUpperCase())}</span>
            </div>
          </div>

          <div class="box">
            <div class="grid">
              <div class="row"><span class="label">Chave de acesso</span><span class="value chave">${escapeHtml(documento.chaveAcesso)}</span></div>
              <div class="row"><span class="label">Tipo</span><span class="value">${escapeHtml(documento.tipo.toUpperCase())}</span></div>
              <div class="row"><span class="label">Numero</span><span class="value">${label(documento.numero)}</span></div>
              <div class="row"><span class="label">Serie</span><span class="value">${label(documento.serie)}</span></div>
              <div class="row"><span class="label">Emissao</span><span class="value">${escapeHtml(formatDate(documento.dataEmissao))}</span></div>
              <div class="row"><span class="label">Valor total</span><span class="value">${label(documento.valorTotal)}</span></div>
            </div>
          </div>

          <div class="box">
            <div class="grid">
              <div class="row full"><span class="label">Emitente</span><span class="value">${label(documento.razaoSocialEmitente)}</span></div>
              <div class="row"><span class="label">CNPJ Emitente</span><span class="value">${label(documento.cnpjEmitente)}</span></div>
              <div class="row"><span class="label">Destinatario</span><span class="value">${label(documento.razaoSocialDestinatario)}</span></div>
              <div class="row"><span class="label">CNPJ Destinatario</span><span class="value">${label(documento.cnpjDestinatario)}</span></div>
              <div class="row full"><span class="label">Protocolo</span><span class="value">${label(documento.protocolo)}</span></div>
            </div>
          </div>

          <div class="footer">
            PDF gerado automaticamente a partir da consulta fiscal.
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function gerarPdfDanfe(documento: DocumentoFiscal): Promise<Buffer> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
    await page.setContent(renderHtml(documento), { waitUntil: 'load' });
    await page.emulateMedia({ media: 'screen' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => {});
  }
}
