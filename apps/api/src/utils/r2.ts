import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

let clientCache: S3Client | null = null;

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID || '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  const bucket = process.env.R2_BUCKET || 'xmldfecentral';
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

  if (!accountId || !accessKeyId || !secretAccessKey || !endpoint || !bucket) return null;

  return { accountId, accessKeyId, secretAccessKey, endpoint, bucket };
}

function getClient(): S3Client | null {
  const config = getR2Config();
  if (!config) return null;

  if (!clientCache) {
    clientCache = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  return clientCache;
}

export function r2EstaConfigurado(): boolean {
  return Boolean(getR2Config());
}

export async function enviarArquivoParaR2(opcoes: {
  chave: string;
  corpo: string | Buffer;
  contentType: string;
  categoria: 'xml' | 'pacote';
  dataEmissao?: Date;
  nomeArquivo: string;
}): Promise<{ bucket: string; key: string } | null> {
  const config = getR2Config();
  const client = getClient();
  if (!config || !client) return null;

  const ano = opcoes.dataEmissao ? String(opcoes.dataEmissao.getUTCFullYear()) : 'sem-data';
  const mes = opcoes.dataEmissao ? String(opcoes.dataEmissao.getUTCMonth() + 1).padStart(2, '0') : '00';
  const key = `${opcoes.categoria}/${ano}/${mes}/${opcoes.nomeArquivo}`;

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: opcoes.corpo,
      ContentType: opcoes.contentType,
      Metadata: {
        chave_acesso: opcoes.chave,
        categoria: opcoes.categoria,
      },
    }),
  );

  return { bucket: config.bucket, key };
}
