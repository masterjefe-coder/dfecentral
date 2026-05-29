declare const process: {
  env: Record<string, string | undefined>;
};

declare class Buffer<TArrayBuffer extends ArrayBufferLike = ArrayBufferLike> extends Uint8Array<TArrayBuffer> {
  static from(data: string, encoding?: string): Buffer;
  static from(data: ArrayLike<number>): Buffer;
  static from(data: ArrayBufferLike): Buffer;
}

declare module 'node:crypto' {
  export function randomUUID(): string;
}

declare module 'node:http' {
  export interface IncomingMessage {
    method?: string;
    url?: string;
    on(event: 'data', listener: (chunk: { toString(): string }) => void): IncomingMessage;
    on(event: 'end', listener: () => void): IncomingMessage;
    on(event: 'error', listener: (err: Error) => void): IncomingMessage;
  }

  export interface ServerResponse {
    writeHead(statusCode: number, headers?: Record<string, string>): ServerResponse;
    end(data?: string | Buffer | Uint8Array | ArrayBufferLike): void;
  }

  export interface Server {
    listen(port: number, hostname: string, listeningListener?: () => void): void;
  }

  export function createServer(
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>,
  ): Server;

  const http: {
    createServer: typeof createServer;
  };

  export default http;
}
