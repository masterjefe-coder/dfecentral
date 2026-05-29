import { chromium } from 'playwright';
import { resolverRecaptcha, type AntiCaptchaConfig } from './captcha.js';
import { reconstruirXML } from './reconstruct-xml.js';
import type { DadosExtraidos } from './reconstruct-xml.js';

const SEFAZ_URL = 'https://www.nfe.fazenda.gov.br/portal/consulta.aspx';

export interface ScraperConfig {
  anticaptcha?: AntiCaptchaConfig;
  timeout?: number;
}

export interface ScrapeResult {
  sucesso: boolean;
  dados?: DadosExtraidos;
  erro?: string;
  xml?: string;
  fonte: string;
}

function extractText(page: any, selector: string): Promise<string> {
  return page.$eval(selector, (el: any) => el.textContent?.trim() || '').catch(() => '');
}

function extractAttr(page: any, selector: string, attr: string): Promise<string> {
  return page.$eval(selector, (el: any) => el.getAttribute(attr) || '').catch(() => '');
}

function parseValor(v: string): string {
  const nums = v.replace(/[R$\s.]/g, '').replace(',', '.');
  return nums;
}

export async function scrapeNFeporChave(
  chaveAcesso: string,
  config: ScraperConfig,
): Promise<ScrapeResult> {
  const timeout = config.timeout || 60000;

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'pt-BR',
    });

    const page = await context.newPage();

    await page.goto(SEFAZ_URL, { waitUntil: 'networkidle', timeout });

    const chaveFormatada = chaveAcesso.replace(/\s/g, '').match(/.{1,4}/g)?.join(' ') || chaveAcesso;

    await page.waitForSelector('input[name*="chave" i], input[id*="chave" i], input[type="text"]', { timeout: 15000 });

    const inputs = await page.$$('input[type="text"]');
    if (inputs.length > 0) {
      await inputs[0].click();
      await inputs[0].fill(chaveFormatada);
    }

    const submitBtn = await page.$('input[type="submit"], button[type="submit"], a[href*="consultar"]');
    if (submitBtn) {
      await submitBtn.click();
    }

    await page.waitForTimeout(3000);

    const recaptchaFrame = page.frame({
      url: /recaptcha\/api2\/(anchor|bframe)/,
    });

    if (!recaptchaFrame && config.anticaptcha) {
      const siteKey = await extractAttr(page, 'div[data-sitekey]', 'data-sitekey')
        || await extractAttr(page, 'div.g-recaptcha', 'data-sitekey');

      if (siteKey) {
        const token = await resolverRecaptcha(siteKey, SEFAZ_URL, config.anticaptcha);

        await page.evaluate((t: string) => {
          const ta = document.createElement('textarea');
          ta.id = 'g-recaptcha-response';
          ta.style.display = 'none';
          document.body.appendChild(ta);
          document.getElementById('g-recaptcha-response')!.textContent = t;
          (window as any).___grecaptcha_cfg?.clients?.forEach((c: any) => {
            c?.callback?.(t);
          });
        }, token);

        await page.waitForTimeout(1000);

        const forms = await page.$$('form');
        for (const form of forms) {
          const btn = await form.$('input[type="submit"], button:has-text("Consultar")');
          if (btn) {
            await btn.click();
            break;
          }
        }
      }
    }

    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    const bodyText = await page.evaluate(() => document.body.innerText);

    if (bodyText.includes('não encontrada') || bodyText.includes('inválida') || bodyText.includes('inexistente')) {
      return { sucesso: false, erro: 'Documento nao encontrado na SEFAZ', fonte: 'scraper' };
    }

    if (currentUrl.includes('consulta.aspx') && !bodyText.includes('Dados da NF-e') && !bodyText.includes('NFe')) {
      return { sucesso: false, erro: 'Falha na consulta - CAPTCHA nao resolvido', fonte: 'scraper' };
    }

    const dados: DadosExtraidos = {
      chaveAcesso,
      uf: chaveAcesso.slice(0, 2),
      anoMes: chaveAcesso.slice(2, 6),
      cnpjEmitente: chaveAcesso.slice(6, 20),
      modelo: chaveAcesso.slice(20, 22),
      serie: String(parseInt(chaveAcesso.slice(22, 25), 10)),
      numero: String(parseInt(chaveAcesso.slice(25, 34), 10)),
      dv: chaveAcesso.slice(43, 44),
      tipo: 'nfe',
      status: 'pendente',
      dataEmissao: new Date().toISOString(),
    };

    const tabelas = await page.$$('table');
    for (const table of tabelas) {
      const html = await table.innerHTML();
      const text = await table.innerText();

      if (text.includes('Emitente') || text.includes('CNPJ')) {
        const rows = await table.$$('tr');
        for (const row of rows) {
          const cells = await row.$$('td, th');
          const labels: string[] = [];
          const values: string[] = [];
          for (const cell of cells) {
            const txt = (await cell.innerText()).trim();
            const isBold = await cell.$('b, strong, th').catch(() => null);
            if (isBold || labels.length <= values.length) {
              labels.push(txt);
            } else {
              values.push(txt);
            }
          }

          for (let i = 0; i < labels.length && i < values.length - 1; i++) {
            const label = labels[i].toLowerCase();
            const val = values[i + 1] || values[i] || '';

            if (label.includes('emitente') || label.includes('razao social') || label.includes('nome')) {
              if (!dados.razaoSocialEmitente) dados.razaoSocialEmitente = val;
            }
            if (label.includes('destinatario') || label.includes('razao social dest')) {
              if (!dados.razaoSocialDestinatario) dados.razaoSocialDestinatario = val;
            }
            if (label.includes('cnpj') && label.includes('emit')) {
              if (val.replace(/\D/g, '').length === 14) {
                dados.cnpjEmitente = val.replace(/\D/g, '');
              }
            }
            if (label.includes('cnpj') && (label.includes('dest') || !dados.cnpjDestinatario)) {
              const cnpj = val.replace(/\D/g, '');
              if (cnpj.length === 14 && cnpj !== dados.cnpjEmitente) {
                dados.cnpjDestinatario = cnpj;
              }
            }
            if (label.includes('valor') || label.includes('total')) {
              const num = parseValor(val);
              if (num && !isNaN(Number(num))) {
                dados.valorTotal = num;
              }
            }
            if (label.includes('serie')) dados.serie = val.replace(/\D/g, '');
            if (label.includes('numero') || label.includes('nfe')) dados.numero = val.replace(/\D/g, '');
            if (label.includes('protocolo') || label.includes('prot')) dados.protocolo = val.replace(/\D/g, '');
            if (label.includes('emissao') || label.includes('data')) dados.dataEmissao = val;
          }
        }
      }
    }

    const strongs = await page.$$('strong, b, label, span');
    for (const el of strongs) {
      const txt = (await el.innerText()).trim();
      const parent = await el.evaluate((e: any) => e.parentElement?.textContent?.trim() || '');
      const full = parent;

      if ((txt.includes('Autorizado') || txt.includes('aprovada')) && !dados.status) {
        dados.status = 'autorizada';
        if (!dados.protocolo) {
          const prot = full.match(/\d{12,15}/)?.[0];
          if (prot) dados.protocolo = prot;
        }
      }
      if (txt.includes('Cancelada') || txt.includes('cancelado')) dados.status = 'cancelada';
      if (txt.includes('Denegada') || txt.includes('denegado')) dados.status = 'denegada';
    }

    const xmlLink = await page.$('a[href*="xml"], a[href*="download"], a:has-text("XML")');
    if (xmlLink) {
      try {
        const href = await xmlLink.getAttribute('href');
        if (href) {
          const xmlUrl = new URL(href, SEFAZ_URL).href;
          const response = await context.request.get(xmlUrl);
          if (response.ok()) {
            const xmlContent = await response.text();
            if (xmlContent.includes('<nfeProc') || xmlContent.includes('<NFe')) {
              dados.xmlOriginal = xmlContent;
              dados.status = 'autorizada';
            }
          }
        }
      } catch {}
    }

    let xmlReconstruido: string | undefined;

    if (dados.xmlOriginal) {
      xmlReconstruido = dados.xmlOriginal;
      console.log(`[scraper] XML original obtido para chave ${chaveAcesso}`);
    } else {
      xmlReconstruido = reconstruirXML(dados);
      console.log(`[scraper] XML reconstruido para chave ${chaveAcesso}`);
    }

    return {
      sucesso: true,
      dados,
      xml: xmlReconstruido,
      fonte: 'scraper',
    };

  } catch (error: any) {
    return {
      sucesso: false,
      erro: error.message || 'Erro no scraper',
      fonte: 'scraper',
    };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
