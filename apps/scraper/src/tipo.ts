import type { DadosExtraidos } from './reconstruct-xml.js';

export function tipoDaChave(chaveAcesso: string): DadosExtraidos['tipo'] {
  const chave = chaveAcesso.replace(/\s/g, '').trim();
  if (/^\d{44}$/.test(chave)) {
    const modelo = chave.slice(20, 22);
    if (modelo === '65') return 'nfce';
    if (modelo === '57') return 'cte';
    if (modelo === '58') return 'mdfe';
    if (modelo === '63') return 'bpe';
    if (modelo === '67') return 'cteos';
    return 'nfe';
  }

  if (chave.length === 50) return 'nfse';
  if (chave.length === 56) return 'dce';
  return 'nfe';
}
