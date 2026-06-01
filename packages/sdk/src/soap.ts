import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { createHash, createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { RequestOptions } from 'node:https';

export interface SoapResponse {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
}

function calcularDigest(xml: string): string {
  return createHash('sha256').update(xml).digest('base64');
}

export function assinarSOAP(
  soapXml: string,
  keyPem: string,
  certPem: string,
): string {
  const digestValue = calcularDigest(soapXml);

  const certClean = certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/[\n\r]/g, '');

  const sign = createSign('sha256WithRSAEncryption');
  sign.update(soapXml);
  sign.end();
  const signatureValue = sign.sign(keyPem, 'base64');

  const wsse = `
<o:Security xmlns:o="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" o:mustUnderstand="1">
  <o:BinarySecurityToken ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary" wsu:Id="CertId">${certClean}</o:BinarySecurityToken>
  <ds:Signature>
    <ds:SignedInfo>
      <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
      <ds:Reference URI="#id-corpo">
        <ds:Transforms>
          <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
          <ds:Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
        </ds:Transforms>
        <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
        <ds:DigestValue>${digestValue}</ds:DigestValue>
      </ds:Reference>
    </ds:SignedInfo>
    <ds:SignatureValue>${signatureValue}</ds:SignatureValue>
    <ds:KeyInfo>
      <o:SecurityTokenReference>
        <o:Reference ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" URI="#CertId"/>
      </o:SecurityTokenReference>
    </ds:KeyInfo>
  </ds:Signature>
</o:Security>`;

  return soapXml.replace('</s:Header>', wsse + '\n</s:Header>');
}

export function montarEnvelope(xmlBody: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
  <s:Header/>
  <s:Body wsu:Id="id-corpo">
    ${xmlBody}
  </s:Body>
</s:Envelope>`;
}

export interface HttpRequestComCertOptions {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  certPath?: string;
  certPass?: string;
  timeout?: number;
}

export function requestComCert(options: HttpRequestComCertOptions): Promise<SoapResponse> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(options.url);
    const isHttps = urlObj.protocol === 'https:';

    const headers: Record<string, string> = { ...(options.headers || {}) };

    const requestOptions: RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method,
      headers,
      timeout: options.timeout || 60000,
      // Alguns endpoints oficiais da SEFAZ retornam cadeia incompleta.
      // Mantemos o TLS permissivo por padr3o e permitimos endurecer via env.
      rejectUnauthorized: process.env.SEFAZ_TLS_STRICT === '1',
    };

    if (isHttps && options.certPath) {
      requestOptions.pfx = readFileSync(options.certPath);
      requestOptions.passphrase = options.certPass;
    }

    const requester = isHttps ? httpsRequest : httpRequest;
    const req = requester(requestOptions as any, (res: any) => {
      const chunks: Array<{ toString(): string }> = [];
      res.on('data', (chunk: { toString(): string }) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          body: Buffer.concat(chunks as any).toString('utf-8'),
          headers: res.headers as Record<string, string>,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

export async function enviarSOAP(
  url: string,
  envelope: string,
  action: string,
  timeout = 60000,
): Promise<SoapResponse> {
  return requestComCert({
    url,
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: action,
    },
    body: envelope,
    timeout,
  });
}

export async function enviarSOAPComCert(
  url: string,
  envelope: string,
  action: string,
  certPath: string,
  certPass: string,
  timeout = 60000,
): Promise<SoapResponse> {
  return requestComCert({
    url,
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: action,
    },
    body: envelope,
    certPath,
    certPass,
    timeout,
  });
}
