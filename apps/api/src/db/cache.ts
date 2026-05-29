import { db } from './index';
import { documentos } from './schema';
import { eq, and } from 'drizzle-orm';
import type { DocumentoFiscal, StatusDocumento, TipoDocumento } from '@dfecentral/sdk';

interface CacheEntry {
  chaveAcesso: string;
  tipo: TipoDocumento;
  numero: string;
  serie: string;
  dataEmissao: string;
  cnpjEmitente: string;
  razaoSocialEmitente?: string | null;
  cnpjDestinatario?: string | null;
  razaoSocialDestinatario?: string | null;
  valorTotal: string;
  status: StatusDocumento;
  xml?: string | null;
  protocolo?: string | null;
}
                                                          
export async function buscarNoCache(chaveAcesso: string): Promise<CacheEntry | null> {
  try {
    const result = await db
      .select()
      .from(documentos)
      .where(eq(documentos.chaveAcesso, chaveAcesso))
      .limit(1);

    if (result.length === 0) return null;

    const r = result[0];
    return {
      chaveAcesso: r.chaveAcesso,
      tipo: r.tipo as TipoDocumento,
      numero: r.numero,
      serie: r.serie,
      dataEmissao: r.dataEmissao?.toISOString() || new Date().toISOString(),
      cnpjEmitente: r.cnpjEmitente,
      razaoSocialEmitente: r.razaoSocialEmitente,
      cnpjDestinatario: r.cnpjDestinatario,
      razaoSocialDestinatario: r.razaoSocialDestinatario,
      valorTotal: r.valorTotal || '0',
      status: r.status as StatusDocumento,
      xml: r.xmlCompleto as string | null,
      protocolo: null,
    };
  } catch {
    return null;
  }
}

export async function salvarNoCache(doc: DocumentoFiscal): Promise<void> {
  try {
    await db
      .insert(documentos)
      .values({
        chaveAcesso: doc.chaveAcesso,
        tipo: doc.tipo,
        numero: doc.numero,
        serie: doc.serie,
        dataEmissao: new Date(doc.dataEmissao),
        cnpjEmitente: doc.cnpjEmitente,
        razaoSocialEmitente: doc.razaoSocialEmitente || null,
        cnpjDestinatario: doc.cnpjDestinatario || null,
        razaoSocialDestinatario: doc.razaoSocialDestinatario || null,
        valorTotal: doc.valorTotal,
        status: doc.status,
        xmlCompleto: doc.xml || null,
      })
      .onConflictDoUpdate({
        target: documentos.chaveAcesso,
        set: {
          status: doc.status,
          valorTotal: doc.valorTotal,
          xmlCompleto: doc.xml || null,
          razaoSocialEmitente: doc.razaoSocialEmitente || null,
          razaoSocialDestinatario: doc.razaoSocialDestinatario || null,
          atualizadoEm: new Date(),
        },
      });
  } catch (error) {
    console.error('[cache] Erro ao salvar:', error);
  }
}

export function docParaFiscal(r: CacheEntry): DocumentoFiscal {
  return {
    chaveAcesso: r.chaveAcesso,
    tipo: r.tipo,
    numero: r.numero,
    serie: r.serie,
    dataEmissao: r.dataEmissao,
    cnpjEmitente: r.cnpjEmitente,
    razaoSocialEmitente: r.razaoSocialEmitente || undefined,
    cnpjDestinatario: r.cnpjDestinatario || undefined,
    razaoSocialDestinatario: r.razaoSocialDestinatario || undefined,
    valorTotal: r.valorTotal,
    status: r.status,
    xml: r.xml || undefined,
    protocolo: r.protocolo || undefined,
  };
}
