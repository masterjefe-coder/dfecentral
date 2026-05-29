const ANTICAPTCHA_URL = 'https://api.anti-captcha.com';

interface CreateTaskResponse {
  errorId: number;
  errorCode?: string;
  errorDescription?: string;
  taskId?: number;
}

interface TaskResultResponse {
  errorId: number;
  errorCode?: string;
  errorDescription?: string;
  status?: 'processing' | 'ready';
  solution?: {
    gRecaptchaResponse?: string;
    token?: string;
  };
  cost?: string;
}

export interface AntiCaptchaConfig {
  apiKey: string;
}

export async function resolverRecaptcha(
  siteKey: string,
  pageUrl: string,
  config: AntiCaptchaConfig,
): Promise<string> {
  const task = await createTask(siteKey, pageUrl, config);
  return waitForResult(task, config);
}

async function createTask(
  websiteKey: string,
  websiteURL: string,
  config: AntiCaptchaConfig,
): Promise<number> {
  const res = await fetch(`${ANTICAPTCHA_URL}/createTask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientKey: config.apiKey,
      task: {
        type: 'RecaptchaV2TaskProxyless',
        websiteURL,
        websiteKey,
      },
    }),
  });

  const data: CreateTaskResponse & { taskId?: number } = await res.json();

  if (data.errorId !== 0) {
    throw new Error(`Anti-Captacha: ${data.errorCode} - ${data.errorDescription}`);
  }

  return data.taskId!;
}

async function waitForResult(
  taskId: number,
  config: AntiCaptchaConfig,
): Promise<string> {
  const maxAttempts = 60;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 3000));

    const res = await fetch(`${ANTICAPTCHA_URL}/getTaskResult`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientKey: config.apiKey,
        taskId,
      }),
    });

    const data: TaskResultResponse = await res.json();

    if (data.errorId !== 0) {
      throw new Error(`Anti-Captacha: ${data.errorCode} - ${data.errorDescription}`);
    }

    if (data.status === 'ready') {
      return data.solution?.gRecaptchaResponse || data.solution?.token || '';
    }
  }

  throw new Error('Anti-Captacha: timeout aguardando resolucao');
}
