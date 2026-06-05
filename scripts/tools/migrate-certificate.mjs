import { readFileSync } from 'node:fs';
import { carregarCertificado } from '/opt/apps/dfecentral/repo/packages/sdk/src/certificate.ts';
import { encontrarUsuarioPorEmail } from '/opt/apps/dfecentral/repo/apps/api/src/db/auth.ts';
import { salvarCertificadoDigital } from '/opt/apps/dfecentral/repo/apps/api/src/db/certificados.ts';

const caminho = process.env.CERT_PATH;
const senha = process.env.CERT_PASSWORD;
const email = process.env.USER_EMAIL;
const cnpj = process.env.CNPJ;
const certName = process.env.CERT_NAME || 'certificado.pfx';

if (!caminho || !senha || !email || !cnpj) {
  throw new Error('Defina CERT_PATH, CERT_PASSWORD, USER_EMAIL e CNPJ antes de executar.');
}

const arquivo = Buffer.from(readFileSync(caminho));
const cert = carregarCertificado(caminho, senha);
const usuario = await encontrarUsuarioPorEmail(email);

if (!usuario) {
  throw new Error('Usuario nao encontrado');
}

const salvo = await salvarCertificadoDigital({
  usuarioId: usuario.id,
  cnpj,
  certificadoCnpj: cert.cnpj,
  nomeArquivo: certName,
  mimeType: 'application/x-pkcs12',
  tamanhoBytes: arquivo.length,
  validadeEm: cert.validoAte,
  arquivo,
  senha,
});

console.log(JSON.stringify({
  usuarioId: usuario.id,
  cnpj: salvo.cnpj,
  certificadoCnpj: salvo.certificadoCnpj,
  aviso: cert.cnpj !== cnpj ? `Certificado identificado como ${cert.cnpj}, armazenado para o CNPJ ${cnpj}.` : undefined,
  validadeEm: salvo.validadeEm.toISOString(),
  nomeArquivo: salvo.nomeArquivo,
}));
