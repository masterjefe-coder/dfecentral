import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createPrivateKey, createSign, X509Certificate } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface CertData {
  pem: string;
  keyPem: string;
  cn: string;
  cnpj: string;
  validoAte: Date;
  emissor: string;
}

function extractCNPJdoSubject(subject: string): string {
  const cnMatch = subject.match(/CN=([^,]+)/);
  if (cnMatch) {
    const cnValue = cnMatch[1].trim();
    const cnCnpj = cnValue.match(/:(\d{14})$/) || cnValue.match(/(\d{14})$/);
    if (cnCnpj) return cnCnpj[1];
  }

  const cnpjMatch = subject.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  if (cnpjMatch) return cnpjMatch[1].replace(/\D/g, '');
  const cnpjPlain = subject.match(/CNPJ[=:](\d{14})/);
  if (cnpjPlain) return cnpjPlain[1];
  const cnpjSerial = subject.match(/(\d{14})/);
  if (cnpjSerial) return cnpjSerial[1];
  throw new Error('CNPJ nao encontrado no certificado');
}

function extractCN(subject: string): string {
  const match = subject.match(/CN=([^,]+)/);
  return match ? match[1].trim() : 'desconhecido';
}

export function carregarCertificado(caminho: string, senha: string): CertData {
  const tmpDir = mkdtempSync(join(tmpdir(), 'dfecentral-cert-'));
  const tmpPem = join(tmpDir, 'cert.pem');
  const tmpKey = join(tmpDir, 'key.pem');

  try {
    const commonArgs = ['pkcs12', '-in', caminho, '-passin', `pass:${senha}`];

    const certResult = spawnSync('openssl', [...commonArgs, '-nokeys', '-out', tmpPem], {
      encoding: 'utf-8',
      timeout: 10000,
    });
    if (certResult.status !== 0) {
      throw new Error(certResult.stderr || certResult.stdout || 'openssl falhou ao extrair certificado');
    }

    const keyResult = spawnSync('openssl', [...commonArgs, '-nocerts', '-nodes', '-out', tmpKey], {
      encoding: 'utf-8',
      timeout: 10000,
    });
    if (keyResult.status !== 0) {
      throw new Error(keyResult.stderr || keyResult.stdout || 'openssl falhou ao extrair chave privada');
    }

    const pem = readFileSync(tmpPem, 'utf-8');
    const keyPem = readFileSync(tmpKey, 'utf-8');

    const firstCert = pem.match(/-----BEGIN CERTIFICATE-----\n[\s\S]*?-----END CERTIFICATE-----/);
    const cert = new X509Certificate(firstCert ? firstCert[0] : pem);

    return {
      pem: firstCert ? firstCert[0] : pem,
      keyPem,
      cn: extractCN(cert.subject),
      cnpj: extractCNPJdoSubject(cert.subject),
      validoAte: new Date(cert.validTo),
      emissor: cert.issuer,
    };
  } catch (err: any) {
    throw new Error(`Falha ao carregar certificado: ${err.message}`);
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

export function montarChavePrivada(keyPem: string) {
  return createPrivateKey(keyPem);
}

export function assinarXML(xml: string, keyPem: string, certPem: string): string {
  const sign = createSign('SHA256');
  sign.update(xml);
  sign.end();
  const assinatura = sign.sign(keyPem, 'base64');

  const sigXml = `
<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
  <SignedInfo>
    <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
    <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
    <Reference URI="">
      <Transforms>
        <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
        <Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      </Transforms>
      <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
      <DigestValue>BASE64_DIGEST</DigestValue>
    </Reference>
  </SignedInfo>
  <SignatureValue>${assinatura}</SignatureValue>
  <KeyInfo>
    <X509Data>
      <X509Certificate>${certPem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|[\n\r]/g, '')}</X509Certificate>
    </X509Data>
  </KeyInfo>
</Signature>`;

  return xml.replace('</envelope>', sigXml + '</envelope>');
}
