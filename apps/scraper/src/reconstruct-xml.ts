export interface DadosExtraidos {
  chaveAcesso: string;
  uf: string;
  anoMes: string;
  cnpjEmitente: string;
  modelo: string;
  serie: string;
  numero: string;
  dv: string;
  tipo: string;
  status: string;
  dataEmissao: string;
  razaoSocialEmitente?: string;
  cnpjDestinatario?: string;
  razaoSocialDestinatario?: string;
  valorTotal?: string;
  protocolo?: string;
  produtos?: Array<{
    nome: string;
    codigo: string;
    quantidade: string;
    valorUnitario: string;
    valorTotal: string;
  }>;
  xmlOriginal?: string;
}

const UFS: Record<string, string> = {
  '11': 'RO','12': 'AC','13': 'AM','14': 'RR','15': 'PA',
  '16': 'AP','17': 'TO','21': 'MA','22': 'PI','23': 'CE',
  '24': 'RN','25': 'PB','26': 'PE','27': 'AL','28': 'SE',
  '29': 'BA','31': 'MG','32': 'ES','33': 'RJ','35': 'SP',
  '41': 'PR','42': 'SC','43': 'RS','50': 'MS','51': 'MT',
  '52': 'GO','53': 'DF',
};

function codMun(uf: string): string {
  const cache: Record<string, string> = {
    '11': '1100015','12': '1200013','13': '1300029','14': '1400027',
    '15': '1500107','16': '1600054','17': '1700109','21': '2100055',
    '22': '2200053','23': '2300100','24': '2400109','25': '2500106',
    '26': '2600100','27': '2700102','28': '2800108','29': '2900103',
    '31': '3100104','32': '3200101','33': '3300100','35': '3500105',
    '41': '4100103','42': '4200102','43': '4300101','50': '5000100',
    '51': '5100105','52': '5200100','53': '5300109',
  };
  return cache[uf] || '0000000';
}

function cNF(chave: string): string {
  return chave.slice(34, 42);
}

export function reconstruirXML(dados: DadosExtraidos): string {
  const ufSigla = UFS[dados.uf] || 'XX';
  const idNFe = `NFe${dados.chaveAcesso}`;
  const dhEmi = dados.dataEmissao || new Date().toISOString();
  const cMunFG = codMun(dados.uf);
  const cNFVal = cNF(dados.chaveAcesso);

  const modelos: Record<string, string> = {
    'nfe': '55','nfce': '65','cte': '57','mdfe': '58','bpe': '63','cteos': '67',
  };
  const mod = modelos[dados.tipo] || '55';

  const statusText: Record<string, string> = {
    autorizada: 'Autorizado o uso da NF-e',
    cancelada: 'Cancelado',
    denegada: 'Denegado',
    pendente: 'Pendente',
  };

  const items = (dados.produtos || [{ nome: 'N/A', codigo: '0001', quantidade: '1', valorUnitario: dados.valorTotal || '0', valorTotal: dados.valorTotal || '0' }])
    .map((p, i) => `
      <det n="${i + 1}">
        <prod>
          <cProd>${escapeXML(p.codigo)}</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>${escapeXML(p.nome)}</xProd>
          <NCM>00000000</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>${p.quantidade}</qCom>
          <vUnCom>${p.valorUnitario}</vUnCom>
          <vProd>${p.valorTotal}</vProd>
          <cEANTrib>SEM GTIN</cEANTrib>
          <uTrib>UN</uTrib>
          <qTrib>${p.quantidade}</qTrib>
          <vUnTrib>${p.valorUnitario}</vUnTrib>
          <indTot>1</indTot>
        </prod>
        <imposto/>
      </det>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="${idNFe}" versao="4.00">
      <ide>
        <cUF>${dados.uf}</cUF>
        <cNF>${cNFVal}</cNF>
        <natOp>VENDA</natOp>
        <mod>${mod}</mod>
        <serie>${dados.serie}</serie>
        <nNF>${dados.numero}</nNF>
        <dhEmi>${dhEmi}</dhEmi>
        <tpNF>1</tpNF>
        <cMunFG>${cMunFG}</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>${dados.dv}</cDV>
        <tpAmb>1</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>1</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
        <verProc>4.00</verProc>
      </ide>
      <emit>
        <CNPJ>${dados.cnpjEmitente}</CNPJ>
        <xNome>${escapeXML(dados.razaoSocialEmitente || 'N/A')}</xNome>
        <enderEmit>
          <xLgr>N/A</xLgr>
          <nro>S/N</nro>
          <xBairro>N/A</xBairro>
          <cMun>${cMunFG}</cMun>
          <xMun>${UFS[dados.uf] || 'N/A'}</xMun>
          <UF>${ufSigla}</UF>
          <CEP>00000000</CEP>
          <cPais>1058</cPais>
          <xPais>BRASIL</xPais>
        </enderEmit>
        <IE>ISENTO</IE>
        <CRT>3</CRT>
      </emit>
      <dest>
        <CNPJ>${dados.cnpjDestinatario || dados.cnpjEmitente}</CNPJ>
        <xNome>${escapeXML(dados.razaoSocialDestinatario || 'N/A')}</xNome>
        <enderDest>
          <xLgr>N/A</xLgr>
          <nro>S/N</nro>
          <xBairro>N/A</xBairro>
          <cMun>${cMunFG}</cMun>
          <xMun>${UFS[dados.uf] || 'N/A'}</xMun>
          <UF>${ufSigla}</UF>
          <CEP>00000000</CEP>
          <cPais>1058</cPais>
          <xPais>BRASIL</xPais>
        </enderDest>
        <indIEDest>9</indIEDest>
      </dest>
      ${items}
      <total>
        <ICMSTot>
          <vBC>0.00</vBC>
          <vICMS>0.00</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vFCPST>0.00</vFCPST>
          <vFCPSTRet>0.00</vFCPSTRet>
          <vProd>${dados.valorTotal || '0.00'}</vProd>
          <vFrete>0.00</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>0.00</vDesc>
          <vII>0.00</vII>
          <vIPI>0.00</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>0.00</vPIS>
          <vCOFINS>0.00</vCOFINS>
          <vOutro>0.00</vOutro>
          <vNF>${dados.valorTotal || '0.00'}</vNF>
        </ICMSTot>
      </total>
      <pag>
        <detPag>
          <indPag>0</indPag>
          <tPag>01</tPag>
          <vPag>${dados.valorTotal || '0.00'}</vPag>
        </detPag>
      </pag>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>1</tpAmb>
      <cUF>${dados.uf}</cUF>
      <nProt>${dados.protocolo || '000000000000000'}</nProt>
      <dhRecbto>${dhEmi}</dhRecbto>
      <digVal/>
      <cStat>100</cStat>
      <xMotivo>${statusText[dados.status] || dados.status}</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;

  return xml;
}

function escapeXML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
