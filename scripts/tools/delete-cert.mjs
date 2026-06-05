import { db } from '/opt/apps/dfecentral/repo/apps/api/src/db/index.ts';
import { certificadosDigitais } from '/opt/apps/dfecentral/repo/apps/api/src/db/schema.ts';
import { and, eq } from 'drizzle-orm';

const usuarioId = process.env.USER_ID;
const cnpj = process.env.CNPJ;

if (!usuarioId || !cnpj) {
  throw new Error('Defina USER_ID e CNPJ antes de executar.');
}

await db.delete(certificadosDigitais).where(and(eq(certificadosDigitais.usuarioId, usuarioId), eq(certificadosDigitais.cnpj, cnpj)));
console.log(JSON.stringify({ deleted: true, usuarioId, cnpj }));
