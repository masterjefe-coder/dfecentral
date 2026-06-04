export interface UfAutorInfo {
  sigla: string;
  codigo: string;
}

const MAPA_UF: Record<string, string> = {
  AC: '12', AL: '27', AM: '13', AP: '16', BA: '29', CE: '23', DF: '53', ES: '32', GO: '52',
  MA: '21', MG: '31', MS: '50', MT: '51', PA: '15', PB: '25', PE: '26', PI: '22', PR: '41',
  RJ: '33', RN: '24', RO: '11', RR: '14', RS: '43', SC: '42', SE: '28', SP: '35', TO: '17',
};

const MAPA_REVERSO: Record<string, string> = Object.fromEntries(
  Object.entries(MAPA_UF).map(([sigla, codigo]) => [codigo, sigla]),
);

export function normalizarUfAutor(valor?: string): UfAutorInfo {
  const bruto = String(valor || 'SC').trim().toUpperCase();

  if (/^\d{2}$/.test(bruto)) {
    return { sigla: MAPA_REVERSO[bruto] || 'SC', codigo: bruto };
  }

  return { sigla: bruto, codigo: MAPA_UF[bruto] || bruto };
}

export function obterUfAutorEnv(padrao = 'SC'): UfAutorInfo {
  return normalizarUfAutor(process.env.SEFAZ_UF_AUTOR || process.env.SEFAZ_CUFAUTOR || padrao);
}
