declare var process: {
  env: Record<string, string | undefined>;
  exit(code?: number): never;
  uptime(): number;
};

interface Buffer extends Uint8Array {
  toString(encoding?: string): string;
}

declare var Buffer: {
  from(data: string | Uint8Array | ArrayBuffer, encoding?: string): Buffer;
  alloc(size: number): Buffer;
  concat(list: readonly Buffer[]): Buffer;
  isBuffer(value: unknown): value is Buffer;
};

declare module 'node:fs' {
  export const readFileSync: (...args: any[]) => any;
  export const writeFileSync: (...args: any[]) => any;
  export const unlinkSync: (...args: any[]) => any;
  export const existsSync: (...args: any[]) => any;
  export const mkdirSync: (...args: any[]) => any;
  export const mkdtempSync: (...args: any[]) => any;
  export const rmSync: (...args: any[]) => any;
}

declare module 'node:child_process' {
  export const spawnSync: (...args: any[]) => any;
}

declare module 'node:crypto' {
  export const createHash: (...args: any[]) => any;
  export const createPrivateKey: (...args: any[]) => any;
  export const createSign: (...args: any[]) => any;
  export const randomBytes: (...args: any[]) => any;
  export const timingSafeEqual: (...args: any[]) => any;

  export class X509Certificate {
    constructor(pem: string);
    subject: string;
    issuer: string;
    validFrom: string;
    validTo: string;
    checkPrivateKey(key: unknown): boolean;
    toString(): string;
  }
}

declare module 'node:os' {
  export const tmpdir: (...args: any[]) => any;
}

declare module 'node:path' {
  export const basename: (...args: any[]) => any;
  export const dirname: (...args: any[]) => any;
  export const extname: (...args: any[]) => any;
  export const join: (...args: any[]) => any;
  export const resolve: (...args: any[]) => any;
  export const sep: string;
}

declare module 'node:zlib' {
  export const gunzipSync: (...args: any[]) => any;
}

declare module 'node:http' {
  export interface IncomingMessage {
    method?: string;
    url?: string;
    statusCode?: number;
    headers: Record<string, string | string[] | undefined>;
    on(event: 'data', listener: (chunk: { toString(): string }) => void): IncomingMessage;
    on(event: 'end', listener: () => void): IncomingMessage;
    on(event: 'error', listener: (err: Error) => void): IncomingMessage;
  }

  export interface ClientRequest {
    on(event: 'error', listener: (err: Error) => void): ClientRequest;
    on(event: 'timeout', listener: () => void): ClientRequest;
    write(data: string | Uint8Array): ClientRequest;
    end(data?: string | Uint8Array): ClientRequest;
    destroy(error?: Error): void;
  }

  export interface RequestOptions {
    [key: string]: any;
  }

  export interface IncomingMessage {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
    on(event: 'data', listener: (chunk: { toString(): string }) => void): IncomingMessage;
    on(event: 'end', listener: () => void): IncomingMessage;
    on(event: 'error', listener: (err: Error) => void): IncomingMessage;
  }

  export interface ServerResponse {
    writeHead(statusCode: number, headers?: Record<string, string>): ServerResponse;
    end(data?: string): void;
  }

  export interface AgentOptions {
    rejectUnauthorized?: boolean;
  }

  export class Agent {
    constructor(options?: AgentOptions);
  }

  export function request(options: RequestOptions, callback?: (res: IncomingMessage) => void): ClientRequest;
  export default request;
}

declare module 'node:https' {
  export interface IncomingMessage {
    method?: string;
    url?: string;
    statusCode?: number;
    headers: Record<string, string | string[] | undefined>;
    on(event: 'data', listener: (chunk: { toString(): string }) => void): IncomingMessage;
    on(event: 'end', listener: () => void): IncomingMessage;
    on(event: 'error', listener: (err: Error) => void): IncomingMessage;
  }

  export interface ClientRequest {
    on(event: 'error', listener: (err: Error) => void): ClientRequest;
    on(event: 'timeout', listener: () => void): ClientRequest;
    write(data: string | Uint8Array): ClientRequest;
    end(data?: string | Uint8Array): ClientRequest;
    destroy(error?: Error): void;
  }

  export interface AgentOptions {
    rejectUnauthorized?: boolean;
  }

  export interface RequestOptions {
    hostname?: string;
    port?: string | number;
    path?: string;
    method?: string;
    headers?: Record<string, string>;
    timeout?: number;
    rejectUnauthorized?: boolean;
    pfx?: Uint8Array;
    passphrase?: string;
  }

  export class Agent {
    constructor(options?: AgentOptions);
  }

  export function request(options: RequestOptions, callback?: (res: IncomingMessage) => void): ClientRequest;
  export function get(...args: any[]): any;
  export default request;
}
