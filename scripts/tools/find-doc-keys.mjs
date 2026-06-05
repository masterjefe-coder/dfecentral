import { db } from '/opt/apps/dfecentral/repo/apps/api/src/db/index.ts';
import { documentos } from '/opt/apps/dfecentral/repo/apps/api/src/db/schema.ts';
import { or, eq, desc } from 'drizzle-orm';

const cnpj = process.env.CNPJ;
const limit = Number.parseInt(process.env.LIMIT || '10', 10);

if (!cnpj) {
  throw new Error('Defina CNPJ antes de executar.');
}

const rows = await db
  .select({ chaveAcesso: documentos.chaveAcesso, tipo: documentos.tipo, dataEmissao: documentos.dataEmissao })
  .from(documentos)
  .where(or(eq(documentos.cnpjEmitente, cnpj), eq(documentos.cnpjDestinatario, cnpj)))
  .orderBy(desc(documentos.dataEmissao))
  .limit(Number.isFinite(limit) && limit > 0 ? limit : 10);

console.log(JSON.stringify(rows));
