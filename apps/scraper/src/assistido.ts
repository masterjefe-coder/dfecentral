import { randomUUID } from 'node:crypto';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { reconstruirXML, type DadosExtraidos } from './reconstruct-xml.js';

const BASE_URL = 'https://www.nfe.fazenda.gov.br/portal';

function tipoDaChave(chaveAcesso: string): DadosExtraidos['tipo'] {
  const modelo = chaveAcesso.slice(20, 22);
  if (modelo === '65') return 'nfce';
  if (modelo === '57') return 'cte';
  if (modelo === '58') return 'mdfe';
  return 'nfe';
}

export type AssistStatus = 'running' | 'aguardando_interacao' | 'concluido' | 'erro';

export interface AssistJobPublicState {
  id: string;
  chaveAcesso: string;
  status: AssistStatus;
  erro?: string;
  mensagem?: string;
  result?: {
    sucesso: boolean;
    dados?: DadosExtraidos;
    xml?: string;
    erro?: string;
    fonte: string;
  };
  viewport: { width: number; height: number };
}

type AssistResult = NonNullable<AssistJobPublicState['result']>;

type AssistAction =
  | { tipo: 'click'; x: number; y: number; button?: 'left' | 'right' | 'middle' }
  | { tipo: 'dblclick'; x: number; y: number; button?: 'left' | 'right' | 'middle' }
  | { tipo: 'type'; text: string; delay?: number }
  | { tipo: 'press'; key: string }
  | { tipo: 'scroll'; deltaX: number; deltaY: number }
  | { tipo: 'wait'; ms: number };

export type { AssistAction };

interface AssistJob {
  id: string;
  chaveAcesso: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  status: AssistStatus;
  erro?: string;
  mensagem?: string;
  result?: AssistResult;
  viewport: { width: number; height: number };
  updatedAt: number;
}

const jobs = new Map<string, AssistJob>();

function parseValor(v: string): string {
  return v.replace(/[R$\s.]/g, '').replace(',', '.');
}

function now() {
  return Date.now();
}

function extractBodyInfo(body: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length - 1; i++) {
    const key = lines[i].toLowerCase();
    const value = lines[i + 1];
    if (key && value) {
      result[key] = value;
    }
  }
  return result;
}

function findVal(content: Record<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    const found = Object.entries(content).find(([key]) => key.includes(k));
    if (found) return found[1];
  }
  return undefined;
}

async function detectCaptcha(page: Page): Promise<boolean> {
  const iframeCount = await page.locator('iframe[src*="hcaptcha"], iframe[src*="captcha"], .h-captcha').count().catch(() => 0);
  if (iframeCount > 0) return true;
  const body = await page.evaluate(() => document.body.innerText).catch(() => '');
  return /captcha|hcaptcha|verifica/i.test(body);
}

async function extractResultFromPage(page: Page, chaveAcesso: string): Promise<AssistResult> {
  const body = await page.evaluate(() => document.body.innerText).catch(() => '');

  if (body.includes('nÃ£o encontrada') || body.includes('invÃ¡lida') || body.includes('inexistente')) {
    return { sucesso: false, erro: 'Documento nao encontrado na SEFAZ', fonte: 'scraper' };
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

  dados.razaoSocialEmitente = findVal(content, ['emitente', 'razao social', 'nome fantasia']) || undefined;
  dados.razaoSocialDestinatario = findVal(content, ['destinatario', 'razao social dest']) || undefined;
  dados.valorTotal = parseValor(findVal(content, ['valor total', 'v.nf', 'valor']) || '0');
  dados.protocolo = findVal(content, ['protocolo', 'n.prot', 'numero protocolo'])?.replace(/\D/g, '') || undefined;

  const statusText = body.toLowerCase();
  if (statusText.includes('autorizado')) dados.status = 'autorizada';
  else if (statusText.includes('cancelada') || statusText.includes('cancelado')) dados.status = 'cancelada';
  else if (statusText.includes('denegada') || statusText.includes('denegado')) dados.status = 'denegada';
  else if (statusText.includes('inutilizada')) dados.status = 'inutilizada';
  else if (statusText.includes('processando')) dados.status = 'processando';

  const xmlLinks = await page.$$eval('a[href*="xml"]', (links) =>
    links.map((l) => (l as HTMLAnchorElement).href).filter(Boolean),
  ).catch(() => []);

  if (xmlLinks.length > 0) {
    try {
      const resp = await page.context().request.get(xmlLinks[0]);
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
}

async function openAssistPage(page: Page, chaveAcesso: string) {
  const consultUrl = `${BASE_URL}/consultaRecaptcha.aspx?tipoConsulta=resumo&tipoConteudo=7PhJ+gAVw2g=`;
  await page.goto(consultUrl, { waitUntil: 'networkidle', timeout: 60000 });
  const chaveField = '#ctl00_ContentPlaceHolder1_txtChaveAcessoResumo';
  await page.waitForSelector(chaveField, { timeout: 15000 });
  await page.fill(chaveField, chaveAcesso);
  const btnSubmit = await page.$('input[type="submit"], button[type="submit"]');
  if (btnSubmit) {
    await btnSubmit.click();
  }
  await page.waitForTimeout(2500);
}

async function createJob(chaveAcesso: string): Promise<AssistJob> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const viewport = { width: 1366, height: 768 };
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport,
    locale: 'pt-BR',
  });
  const page = await context.newPage();

  await openAssistPage(page, chaveAcesso);

  const id = randomUUID();
  const job: AssistJob = {
    id,
    chaveAcesso,
    browser,
    context,
    page,
    status: 'running',
    viewport,
    updatedAt: now(),
  };
  jobs.set(id, job);
  await refreshJob(job);
  return job;
}

async function refreshJob(job: AssistJob) {
  job.updatedAt = now();
  const captcha = await detectCaptcha(job.page);
  if (captcha && job.status !== 'concluido') {
    job.status = 'aguardando_interacao';
    job.mensagem = 'Resolvendo captcha / interagindo com a pagina';
    return;
  }

  const result = await extractResultFromPage(job.page, job.chaveAcesso);
  if (result.sucesso) {
    job.status = 'concluido';
    job.result = result;
    job.mensagem = 'Consulta finalizada';
    await closeJob(job.id, false);
  } else {
    job.status = 'aguardando_interacao';
    job.mensagem = result.erro || 'Interacao necessaria';
    job.result = result;
  }
}

export async function startAssistJob(chaveAcesso: string) {
  const job = await createJob(chaveAcesso);
  return toPublicState(job);
}

export async function getAssistJobState(id: string) {
  const job = jobs.get(id);
  if (!job) return null;
  return toPublicState(job);
}

export async function getAssistJobFrame(id: string): Promise<Buffer | null> {
  const job = jobs.get(id);
  if (!job) return null;
  return await job.page.screenshot({ type: 'png' }).catch(() => null);
}

export async function performAssistAction(id: string, action: AssistAction) {
  const job = jobs.get(id);
  if (!job) return null;

  switch (action.tipo) {
    case 'click':
      await job.page.mouse.click(action.x, action.y, { button: action.button || 'left' });
      break;
    case 'dblclick':
      await job.page.mouse.dblclick(action.x, action.y, { button: action.button || 'left' });
      break;
    case 'type':
      await job.page.keyboard.type(action.text, { delay: action.delay ?? 10 });
      break;
    case 'press':
      await job.page.keyboard.press(action.key);
      break;
    case 'scroll':
      await job.page.mouse.wheel(action.deltaX, action.deltaY);
      break;
    case 'wait':
      await job.page.waitForTimeout(action.ms);
      break;
  }

  await refreshJob(job);
  return toPublicState(job);
}

export async function finalizeAssistJob(id: string) {
  const job = jobs.get(id);
  if (!job) return null;

  const captcha = await detectCaptcha(job.page);
  if (captcha) {
    job.status = 'aguardando_interacao';
    job.mensagem = 'Captcha ainda precisa ser resolvido';
    return toPublicState(job);
  }

  const result = await extractResultFromPage(job.page, job.chaveAcesso);
  if (result.sucesso) {
    job.status = 'concluido';
    job.result = result;
    job.mensagem = 'Consulta finalizada';
    await closeJob(job.id, false);
    return toPublicState(job);
  }

  job.status = 'erro';
  job.result = result;
  job.erro = result.erro || 'Falha na consulta assistida';
  return toPublicState(job);
}

export async function abortAssistJob(id: string) {
  const job = jobs.get(id);
  if (!job) return false;
  await closeJob(id, true);
  return true;
}

async function closeJob(id: string, remove = true) {
  const job = jobs.get(id);
  if (!job) return;

  try { await job.context.close(); } catch {}
  try { await job.browser.close(); } catch {}
  if (remove) jobs.delete(id);
}

function toPublicState(job: AssistJob): AssistJobPublicState {
  return {
    id: job.id,
    chaveAcesso: job.chaveAcesso,
    status: job.status,
    erro: job.erro,
    mensagem: job.mensagem,
    result: job.result,
    viewport: job.viewport,
  };
}

setInterval(() => {
  const cutoff = now() - 30 * 60 * 1000;
  for (const [id, job] of jobs.entries()) {
    if (job.updatedAt < cutoff) {
      void closeJob(id);
    }
  }
}, 5 * 60 * 1000);
