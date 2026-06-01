const ANTICAPTCHA_URL = 'https://api.anti-captcha.com';

interface AntiCaptchaResponse {
  errorId: number;
  errorCode?: string;
  errorDescription?: string;
  taskId?: number;
  status?: 'processing' | 'ready';
  solution?: {
    gRecaptchaResponse?: string;
    token?: string;
    text?: string;
  };
}

export interface AntiCaptchaConfig {
  apiKey: string;
}

async function apiCall(method: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${ANTICAPTCHA_URL}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function resolverCaptcha(
  siteKey: string,
  pageUrl: string,
  config: AntiCaptchaConfig,
  tipo: 'recaptcha' | 'hcaptcha' | 'imagem' = 'hcaptcha',
): Promise<string> {
  const taskType = tipo === 'imagem'
    ? 'ImageToTextTask'
    : tipo === 'hcaptcha'
      ? 'HCaptchaTaskProxyless'
      : 'RecaptchaV2TaskProxyless';

  const task = tipo === 'imagem'
    ? { type: taskType, body: siteKey }
    : { type: taskType, websiteURL: pageUrl, websiteKey: siteKey };

  const createResult: AntiCaptchaResponse = await apiCall('createTask', {
    clientKey: config.apiKey,
    task,
  });

  if (createResult.errorId !== 0) {
    throw new Error(`Anti-Captacha: ${createResult.errorCode} - ${createResult.errorDescription}`);
  }

  const taskId = createResult.taskId!;

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3000));

    const result: AntiCaptchaResponse = await apiCall('getTaskResult', {
      clientKey: config.apiKey,
      taskId,
    });

    if (result.errorId !== 0) {
      throw new Error(`Anti-Captacha: ${result.errorCode} - ${result.errorDescription}`);
    }

    if (result.status === 'ready') {
      return result.solution?.text || result.solution?.token || result.solution?.gRecaptchaResponse || '';
    }
  }

  throw new Error('Anti-Captacha: timeout');
}

export async function resolverCaptchaImagem(base64: string, config: AntiCaptchaConfig): Promise<string> {
  return resolverCaptcha(base64, 'image://local', config, 'imagem');
}

export async function verificarSaldo(config: AntiCaptchaConfig): Promise<number> {
  const result = await apiCall('getBalance', {
    clientKey: config.apiKey,
  });
  return result.balance || 0;
}
