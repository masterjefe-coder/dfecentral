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

function normalizarChave(chaveAcesso: string): string {
  return chaveAcesso.replace(/\s/g, '').trim();
}

function detectarTipoPorChave(chaveAcesso: string): DadosExtraidos['tipo'] {
  const chave = normalizarChave(chaveAcesso);
  if (/^\d{44}$/.test(chave)) {
    const modelo = chave.slice(20, 22);
    if (modelo === '65') return 'nfce';
    if (modelo === '57') return 'cte';
    if (modelo === '58') return 'mdfe';
    return 'nfe';
  }

  if (chave.length === 50) return 'nfse';
  if (chave.length === 56) return 'dce';
  return 'nfe';
}

function extrairCamposBasicos(chaveAcesso: string, tipo: DadosExtraidos['tipo']): DadosExtraidos {
  const chave = normalizarChave(chaveAcesso);
  const dados: DadosExtraidos = {
    chaveAcesso: chave,
    uf: /^\d{44}$/.test(chave) ? chave.slice(0, 2) : '',
    anoMes: /^\d{44}$/.test(chave) ? chave.slice(2, 6) : '',
    cnpjEmitente: /^\d{44}$/.test(chave) ? chave.slice(6, 20) : '',
    modelo: /^\d{44}$/.test(chave) ? chave.slice(20, 22) : '',
    serie: /^\d{44}$/.test(chave) ? String(parseInt(chave.slice(22, 25), 10)) : '',
    numero: /^\d{44}$/.test(chave) ? String(parseInt(chave.slice(25, 34), 10)) : '',
    dv: /^\d{44}$/.test(chave) ? chave.slice(43, 44) : '',
    tipo,
    status: 'pendente',
    dataEmissao: new Date().toISOString(),
  };

  return dados;
}

function extrairTextoChave(content: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const found = Object.entries(content).find(([candidate]) => candidate.includes(key));
    if (found) return found[1];
  }
  return undefined;
}

async function extrairResultadoGenerico(page: import('playwright').Page, chaveAcesso: string, tipo: DadosExtraidos['tipo']): Promise<ScrapeResult> {
  const body = await page.evaluate(() => document.body.innerText).catch(() => '');

  if (/n[aã]o encontrada|inexistente|inv[aá]lida|erro de consulta|n[aã]o foi poss[ií]vel/i.test(body)) {
    return { sucesso: false, erro: 'Documento nao encontrado na consulta publica', fonte: 'scraper' };
  }

  const content = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    const result: Record<string, string> = {};

    tables.forEach((t) => {
      const rows = t.querySelectorAll('tr');
      rows.forEach((r) => {
        const cells = r.querySelectorAll('td, th');
        const texts = Array.from(cells).map((c) => (c as HTMLElement).innerText?.trim()).filter(Boolean) as string[];
        for (let i = 0; i < texts.length - 1; i++) {
          result[texts[i].toLowerCase()] = texts[i + 1];
        }
      });
    });

    const strongs = Array.from(document.querySelectorAll('strong, b, label, span'));
    strongs.forEach((el) => {
      const txt = (el as HTMLElement).innerText?.trim();
      if (txt) result[txt.toLowerCase()] = txt;
    });

    return result;
  }).catch(() => ({} as Record<string, string>));

  const dados = extrairCamposBasicos(chaveAcesso, tipo);
  dados.razaoSocialEmitente = extrairTextoChave(content, ['emitente', 'prestador', 'remetente', 'razao social', 'nome fantasia']) || undefined;
  dados.razaoSocialDestinatario = extrairTextoChave(content, ['destinatario', 'tomador', 'recebedor', 'razao social dest']) || undefined;
  dados.cnpjEmitente = extrairTextoChave(content, ['cpf/cnpj do emitente', 'cpf/cnpj', 'cnpj emitente', 'emitente'])?.replace(/\D/g, '') || dados.cnpjEmitente;
  dados.cnpjDestinatario = extrairTextoChave(content, ['cpf/cnpj do destinatario', 'destinatario', 'tomador'])?.replace(/\D/g, '') || dados.cnpjDestinatario;
  dados.numero = extrairTextoChave(content, ['numero', 'número', 'nfs-e', 'nfse', 'dps'])?.replace(/\D/g, '') || dados.numero;
  dados.serie = extrairTextoChave(content, ['serie', 'série'])?.replace(/\D/g, '') || dados.serie;
  dados.valorTotal = parseValor(extrairTextoChave(content, ['valor total', 'v.nf', 'valor', 'v. total']) || '0');
  dados.protocolo = extrairTextoChave(content, ['protocolo', 'n.prot', 'numero protocolo'])?.replace(/\D/g, '') || undefined;

  const lowerBody = body.toLowerCase();
  if (lowerBody.includes('autoriz')) dados.status = 'autorizada';
  else if (lowerBody.includes('cancelada') || lowerBody.includes('cancelado')) dados.status = 'cancelada';
  else if (lowerBody.includes('denegada') || lowerBody.includes('denegado')) dados.status = 'denegada';
  else if (lowerBody.includes('inutilizada')) dados.status = 'inutilizada';
  else if (lowerBody.includes('processando')) dados.status = 'processando';

  const xmlLinks = await page.$$eval('a[href*="xml"], a[href$=".xml"]', (links) =>
    links.map((l) => (l as HTMLAnchorElement).href).filter(Boolean),
  ).catch(() => [] as string[]);

  if (xmlLinks.length > 0) {
    try {
      const resp = await page.context().request.get(xmlLinks[0]);
      if (resp.ok()) {
        dados.xmlOriginal = await resp.text();
      }
    } catch {
      // ignore
    }
  }

  return { sucesso: true, dados, xml: dados.xmlOriginal, fonte: 'scraper' };
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

export async function scrapeNfsePorChave(
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
    await page.goto('https://www.nfse.gov.br/consultapublica', { waitUntil: 'domcontentloaded', timeout });
    await page.locator('#ChaveAcesso').waitFor({ state: 'visible', timeout: 15000 });
    await page.check('input[name="TipoConsulta"][value="1"]').catch(() => null);
    await page.fill('#ChaveAcesso', chaveAcesso);
    await page.click('#btnSubmitHCaptcha').catch(async () => {
      await page.locator('button[type="submit"]').click({ force: true });
    });

    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(1500);

    return await extrairResultadoGenerico(page, chaveAcesso, 'nfse');
  } catch (error: any) {
    return { sucesso: false, erro: error.message || 'Erro na consulta NFS-e', fonte: 'scraper' };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

export async function scrapeDcePorChave(
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
    await page.goto('https://sped.fazenda.pr.gov.br/webservices/sped/dce/completa', { waitUntil: 'domcontentloaded', timeout });
    await page.locator('#edit-txchave').waitFor({ state: 'visible', timeout: 15000 });
    await page.fill('#edit-txchave', chaveAcesso);

    await page.waitForFunction(() => {
      const img = document.querySelector('img[alt="CAPTCHA de imagem"]') as HTMLImageElement | null;
      return !!img?.getAttribute('src');
    }, null, { timeout: 15000 }).catch(() => null);

    const captchaSrc = await page.getAttribute('img[alt="CAPTCHA de imagem"]', 'src').catch(() => null);
    if (!captchaSrc) {
      return { sucesso: false, erro: 'Captcha da DC-e indisponivel', fonte: 'scraper' };
    }

    if (!config.anticaptcha) {
      return { sucesso: false, erro: 'Captcha da DC-e exige anti-captcha configurado', fonte: 'scraper' };
    }

    const imageUrl = new URL(captchaSrc, page.url()).toString();
    const imageResp = await page.context().request.get(imageUrl);
    const imageBuffer = Buffer.from(await imageResp.body());
    const imageBase64 = (imageBuffer as any).toString('base64');
    const token = await resolverCaptcha(imageBase64, 'image://local', config.anticaptcha, 'imagem');
    await page.fill('#edit-captcha-response', token);
    await page.check('#edit-txambiente-1').catch(() => null);
    await page.click('#edit-txconsultar');

    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(1500);

    return await extrairResultadoGenerico(page, chaveAcesso, 'dce');
  } catch (error: any) {
    return { sucesso: false, erro: error.message || 'Erro na consulta DC-e', fonte: 'scraper' };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

export async function scrapeDocumentoPorChave(
  chaveAcesso: string,
  config: ScraperConfig,
  tipo?: DadosExtraidos['tipo'],
): Promise<ScrapeResult> {
  const clean = normalizarChave(chaveAcesso);
  const tipoDetectado = tipo || detectarTipoPorChave(clean);

  if (tipoDetectado === 'nfse') {
    return scrapeNfsePorChave(clean, config);
  }

  if (tipoDetectado === 'dce') {
    return scrapeDcePorChave(clean, config);
  }

  return scrapeNFeporChave(clean, config);
}
