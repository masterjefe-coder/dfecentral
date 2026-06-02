import { chromium, type Browser, type BrowserContext } from 'playwright';

export const SCRAPER_VIEWPORT = { width: 1366, height: 768 };
export const SCRAPER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export async function criarBrowserScraper(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
}

export async function criarContextoScraper(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    userAgent: SCRAPER_USER_AGENT,
    viewport: SCRAPER_VIEWPORT,
    locale: 'pt-BR',
  });
}
