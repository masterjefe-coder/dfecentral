import { createHash, createSign } from 'node:crypto';

export interface SoapResponse {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
}

function canonicalizar(xml: string): string {
  return xml
    .replace(/>\s+</g, '><')
    .replace(/\n\s*/g, '')
    .trim();
}

function calcularDigest(xml: string): string {
  return createHash('sha256').update(xml).digest('base64');
}

export function assinarSOAP(
  soapXml: string,
  keyPem: string,
  certPem: string,
): string {
  const can = canonicalizar(soapXml);

  const digestValue = calcularDigest(can);

  const signedInfo = `
<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
  <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
  <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
  <Reference URI="#id-corpo">
    <Transforms>
      <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
      <Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
    </Transforms>
    <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
    <DigestValue>${digestValue}</DigestValue>
  </Reference>
</SignedInfo>`.trim();

  const sign = createSign('sha256WithRSAEncryption');
  sign.update(canonicalizar(signedInfo));
  sign.end();
  const signatureValue = sign.sign(keyPem, 'base64');

  const certClean = certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/[\n\r]/g, '');

  const wsse = `
<o:Security xmlns:o="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" o:mustUnderstand="1">
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

export function montarEnvelope(xmlBody: string, action?: string): string {
  const wsAction = action ? `xmlns:m="${action}"` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
  <s:Header/>
  <s:Body wsu:Id="id-corpo">
    ${xmlBody}
  </s:Body>
</s:Envelope>`;
}

export async function enviarSOAP(
  url: string,
  envelope: string,
  action: string,
  timeout = 30000,
): Promise<SoapResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: action,
        'Content-Length': String(Buffer.byteLength(envelope, 'utf-8')),
      },
      body: envelope,
      signal: controller.signal,
    });

    return {
      statusCode: response.status,
      body: await response.text(),
      headers: Object.fromEntries(response.headers.entries()),
    };
  } finally {
    clearTimeout(timer);
  }
}
