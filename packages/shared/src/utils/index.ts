/**
 * Formata CNPJ para exibição: XX.XXX.XXX/XXXX-XX
 */
export function formatarCNPJ(cnpj: string): string {
  const apenasNumeros = cnpj.replace(/\D/g, '');
  return apenasNumeros.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

/**
 * Formata CPF para exibição: XXX.XXX.XXX-XX
 */
export function formatarCPF(cpf: string): string {
  const apenasNumeros = cpf.replace(/\D/g, '');
  return apenasNumeros.replace(
    /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
    '$1.$2.$3-$4'
  );
}

/**
 * Formata valor monetário para BRL
 */
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

/**
 * Formata data para DD/MM/AAAA HH:mm
 */
export function formatarData(data: string | Date): string {
  const d = typeof data === 'string' ? new Date(data) : data;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Formata data para DD/MM/AAAA
 */
export function formatarDataCurta(data: string | Date): string {
  const d = typeof data === 'string' ? new Date(data) : data;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/**
 * Valida se uma chave de acesso tem 44 dígitos
 */
export function validarChaveAcesso(chave: string): boolean {
  return /^\d{44}$/.test(chave.replace(/\D/g, ''));
}

/**
 * Valida se um CNPJ é válido (com dígitos verificadores)
 */
export function validarCNPJ(cnpj: string): boolean {
  const apenasNumeros = cnpj.replace(/\D/g, '');
  if (apenasNumeros.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(apenasNumeros)) return false;

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const calcDigito = (pesos: number[]): number => {
    const digitos = apenasNumeros.split('').map(Number);
    const soma = pesos.reduce((acc, peso, i) => acc + digitos[i] * peso, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const digito1 = calcDigito(pesos1);
  const digito2 = calcDigito(pesos2);

  return (
    digito1 === Number(apenasNumeros[12]) &&
    digito2 === Number(apenasNumeros[13])
  );
}

/**
 * Mascara para input de CNPJ: XX.XXX.XXX/XXXX-XX
 */
export function mascaraCNPJ(valor: string): string {
  const apenasNumeros = valor.replace(/\D/g, '').slice(0, 14);
  return apenasNumeros
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/**
 * Mascara para input de chave de acesso
 */
export function mascaraChaveAcesso(valor: string): string {
  const apenasNumeros = valor.replace(/\D/g, '').slice(0, 44);
  return apenasNumeros.replace(/(\d{4})(?=\d)/g, '$1 ');
}
