export function parseValor(v: string): string {
  return v.replace(/[R$\s.]/g, '').replace(',', '.');
}

export function extrairTextoPorChaves(content: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const found = Object.entries(content).find(([candidate]) => candidate.includes(key));
    if (found) return found[1];
  }
  return undefined;
}
