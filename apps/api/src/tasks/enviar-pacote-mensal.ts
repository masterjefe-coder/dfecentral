import { db } from '../db/index.js';
import { usuarios } from '../db/schema.js';
import {
  enviarPacoteXmlMensal,
  mesAnterior,
  obterDocumentosXmlMes,
  obterEmailContabilidade,
} from '../utils/contabilidade.js';

function preferenciasComoObjeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {};
}

async function main() {
  const mes = mesAnterior(new Date());
  const lista = await db.select({
    id: usuarios.id,
    nome: usuarios.nome,
    email: usuarios.email,
    preferencias: usuarios.preferencias,
  }).from(usuarios);

  let enviados = 0;
  let pulados = 0;
  let falhas = 0;

  for (const usuario of lista) {
    const preferencias = preferenciasComoObjeto(usuario.preferencias);
    if (!preferencias.contabilidadeEnvioAutomatico) {
      pulados += 1;
      continue;
    }

    const destino = obterEmailContabilidade(preferencias);
    if (!destino) {
      pulados += 1;
      console.log(`[pacote-mensal] ${usuario.nome}: e-mail da contabilidade nao configurado, ignorado.`);
      continue;
    }

    const incluirEntradas = Boolean(preferencias.contabilidadePacoteIncluirEntradas ?? preferencias.contabilidadeIncluirEntradas);
    const documentos = await obterDocumentosXmlMes(usuario.id, mes, incluirEntradas);

    if (documentos.length === 0) {
      pulados += 1;
      console.log(`[pacote-mensal] ${usuario.nome}: sem XMLs para ${mes}, ignorado.`);
      continue;
    }

    try {
      const pacote = await enviarPacoteXmlMensal({
        usuarioId: usuario.id,
        to: destino,
        mes,
        incluirEntradas,
        documentos,
      });

      enviados += 1;
      console.log(`[pacote-mensal] ${usuario.nome}: enviado ${pacote.total} XMLs para ${destino}.`);
    } catch (erro) {
      falhas += 1;
      console.error(`[pacote-mensal] ${usuario.nome}: falha ao enviar.`, erro);
    }
  }

  console.log(`[pacote-mensal] concluido mes=${mes} enviados=${enviados} pulados=${pulados} falhas=${falhas}`);
}

main().catch((erro) => {
  console.error('[pacote-mensal] erro fatal', erro);
  process.exit(1);
});
