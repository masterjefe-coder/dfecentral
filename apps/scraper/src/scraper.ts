import { chromium } from 'playwright';
import { resolverCaptcha, type AntiCaptchaConfig } from './captcha.js';
import { reconstruirXML } from './reconstruct-xml.js';
import type { DadosExtraidos } from './reconstruct-xml.js';

const BASE_URL = 'https://www.nfe.fazenda.gov.br/portal';

function tipoDaChave(chaveAcesso: string): DadosExtraidos['tipo'] {
  const modelo = chaveAcesso.slice(20, 22);
  if (modelo === '65') return 'nfce';
  if (modelo === '57') return 'cte';
  if (modelo === '58') return 'mdfe';
  return 'nfe';
}

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

function parseValor(v: string): string {
  return v.replace(/[R$\s.]/g, '').replace(',', '.');
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
        '--no-sandbox', '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', '--disable-gpu',
      ],
    });

    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'pt-BR',
    });

    const page = await ctx.newPage();

    const consultUrl = `${BASE_URL}/consultaRecaptcha.aspx?tipoConsulta=resumo&tipoConteudo=7PhJ+gAVw2g=`;
    await page.goto(consultUrl, { waitUntil: 'networkidle', timeout });

    const chaveField = '#ctl00_ContentPlaceHolder1_txtChaveAcessoResumo';
    await page.waitForSelector(chaveField, { timeout: 15000 });
    await page.fill(chaveField, chaveAcesso);

    const hcaptchaKey = (await page.getAttribute('.h-captcha', 'data-sitekey').catch(() => null)) || 'e72d2f82-9594-4448-a875-47ded9a1898a';

    if (config.anticaptcha) {
      console.log(`[scraper] Resolvendo hCaptcha (sitekey: ${hcaptchaKey})...`);
      const token = await resolverCaptcha(
        hcaptchaKey,
        consultUrl,
        config.anticaptcha,
        'hcaptcha',
      );

      await page.evaluate((t: string) => {
        const ta = document.querySelector('textarea[name="h-captcha-response"]') as HTMLTextAreaElement;
        if (ta) {
          ta.textContent = t;
          ta.style.display = 'block';
        }
        const el = document.querySelector('.h-captcha') as HTMLElement;
        if (el) {
          el.dispatchEvent(new Event('checkCaptcha', { bubbles: true }));
        }
      }, token);

      await page.waitForTimeout(2000);
    }

    const btnSubmit = await page.$('input[type="submit"], button[type="submit"]');
    if (btnSubmit) {
      await btnSubmit.click();
    }

    await page.waitForTimeout(3000);

    const body = await page.evaluate(() => document.body.innerText);

    if (body.includes('não encontrada') || body.includes('inválida') || body.includes('inexistente')) {
      return { sucesso: false, erro: 'Documento nao encontrado na SEFAZ', fonte: 'scraper' };
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
      tipo: tipoDaChave(chaveAcesso),
      status: 'pendente',
      dataEmissao: new Date().toISOString(),
    };

    const content = await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      const result: Record<string, string> = {};
      tables.forEach((t) => {
        const rows = t.querySelectorAll('tr');
        rows.forEach((r) => {
          const cells = r.querySelectorAll('td, th');
          const texts = Array.from(cells).map((c) => (c as HTMLElement).innerText?.trim());
          for (let i = 0; i < texts.length - 1; i++) {
            result[texts[i]?.toLowerCase()] = texts[i + 1];
          }
        });
      });

      const strongs = Array.from(document.querySelectorAll('strong, b, label, span'));
      strongs.forEach((el) => {
        const txt = (el as HTMLElement).innerText?.trim();
        if (txt) result[txt.toLowerCase()] = txt;
      });

      return result;
    });

    function findVal(keys: string[]): string | undefined {
      for (const k of keys) {
        const found = Object.entries(content).find(([key]) => key.includes(k));
        if (found) return found[1];
      }
      return undefined;
    }

    dados.razaoSocialEmitente = findVal(['emitente', 'razao social', 'nome fantasia']) || undefined;
    dados.razaoSocialDestinatario = findVal(['destinatario', 'razao social dest']) || undefined;
    dados.valorTotal = parseValor(findVal(['valor total', 'v.nf', 'valor']) || '0');
    dados.protocolo = findVal(['protocolo', 'n.prot', 'numero protocolo'])?.replace(/\D/g, '') || undefined;

    const statusText = body.toLowerCase();
    if (statusText.includes('autorizado')) dados.status = 'autorizada';
    else if (statusText.includes('cancelada') || statusText.includes('cancelado')) dados.status = 'cancelada';
    else if (statusText.includes('denegada') || statusText.includes('denegado')) dados.status = 'denegada';
    else if (statusText.includes('inutilizada')) dados.status = 'inutilizada';
    else if (statusText.includes('processando')) dados.status = 'processando';

    const xmlLinks = await page.$$eval('a[href*="xml"]', (links) =>
      links.map((l) => (l as HTMLAnchorElement).href).filter(Boolean),
    );
    if (xmlLinks.length > 0) {
      try {
        const resp = await ctx.request.get(xmlLinks[0]);
        if (resp.ok()) {
          const xml = await resp.text();
          if (xml.includes('<nfeProc') || xml.includes('<NFe')) {
            dados.xmlOriginal = xml;
            dados.status = 'autorizada';
          }
        }
      } catch {}
    }

    const xml = dados.xmlOriginal || reconstruirXML(dados);
    return { sucesso: true, dados, xml, fonte: 'scraper' };

  } catch (error: any) {
    return { sucesso: false, erro: error.message || 'Erro no scraper', fonte: 'scraper' };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
