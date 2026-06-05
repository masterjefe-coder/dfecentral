import { carregarCertificado } from '/opt/apps/dfecentral/repo/packages/sdk/src/certificate.ts';

const senha = process.env.CERT_PASSWORD;
const arquivos = (process.env.CERT_PATHS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

if (!senha || arquivos.length === 0) {
  throw new Error('Defina CERT_PASSWORD e CERT_PATHS (lista separada por virgula).');
}

for (const arquivo of arquivos) {
  try {
    const cert = carregarCertificado(arquivo, senha);
    console.log(JSON.stringify({ arquivo, cnpj: cert.cnpj, validoAte: cert.validoAte.toISOString(), emissor: cert.emissor }));
  } catch (error) {
    console.log(JSON.stringify({ arquivo, erro: error instanceof Error ? error.message : String(error) }));
  }
}
