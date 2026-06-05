import { obterSdkConfigComCertificado } from '/opt/apps/dfecentral/repo/apps/api/src/utils/certificados.ts';

const usuarioId = process.env.USER_ID;
const cnpj = process.env.CNPJ;

if (!usuarioId || !cnpj) {
  throw new Error('Defina USER_ID e CNPJ antes de executar.');
}

const { config, cleanup } = await obterSdkConfigComCertificado({
  usuarioId,
  cnpj,
});

try {
  console.log(JSON.stringify({
    hasCert: !!config.certificado,
    caminho: config.certificado?.caminho?.slice(-40),
    timeout: config.timeout,
  }));
} finally {
  cleanup?.();
}
