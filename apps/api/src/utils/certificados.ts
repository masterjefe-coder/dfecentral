import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { carregarCertificado } from '@dfecentral/sdk';
import type { SdkConfig } from '@dfecentral/sdk';
import { descriptografarBuffer, descriptografarTexto, obterCertificadoDigitalUsuario } from '../db/certificados.js';
import { obterEmpresaAtiva } from '../db/auth.js';

export async function obterSdkConfigComCertificado(input: {
  usuarioId?: string;
  cnpj?: string | null;
}): Promise<{ config: SdkConfig; cleanup?: () => void }> {
  const ambiente = (Number(process.env.SEFAZ_AMBIENTE) || 1) as 1 | 2;
  const timeout = 45000;
  const certificadoGlobal =
    process.env.SEFAZ_CERT_PATH && process.env.SEFAZ_CERT_PASS
      ? { caminho: process.env.SEFAZ_CERT_PATH, senha: process.env.SEFAZ_CERT_PASS }
      : undefined;

  if (!input.usuarioId) {
    return { config: { ambiente, certificado: certificadoGlobal, timeout } };
  }

  const cnpj = input.cnpj?.replace(/\D/g, '').slice(0, 14) || (await obterEmpresaAtiva(input.usuarioId)) || null;
  const certificado = await obterCertificadoDigitalUsuario(input.usuarioId, cnpj);
  if (!certificado) {
    return { config: { ambiente, certificado: certificadoGlobal, timeout } };
  }

  const tmpDir = mkdtempSync(join(tmpdir(), 'dfecentral-cert-'));
  const caminho = join(tmpDir, `${certificado.cnpj}.pfx`);
  writeFileSync(caminho, descriptografarBuffer(certificado.arquivoCriptografado));
  const senha = descriptografarTexto(certificado.senhaCriptografada);

  // Valida antes de devolver para os consumidores oficiais.
  carregarCertificado(caminho, senha);

  return {
    config: { ambiente, certificado: { caminho, senha }, timeout },
    cleanup: () => {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    },
  };
}
