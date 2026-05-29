import { z } from 'zod';

export const chaveAcessoSchema = z.string().regex(
  /^\d{44}$/,
  'Chave de acesso deve ter exatamente 44 dígitos numéricos'
);

export const cnpjSchema = z.string().regex(
  /^\d{14}$/,
  'CNPJ deve ter exatamente 14 dígitos numéricos'
);

export const cpfSchema = z.string().regex(
  /^\d{11}$/,
  'CPF deve ter exatamente 11 dígitos numéricos'
);

export const tipoDocumentoSchema = z.enum(['nfe', 'nfce', 'nfse', 'cte', 'mdfe', 'dce']);

export const statusDocumentoSchema = z.enum([
  'autorizada',
  'cancelada',
  'denegada',
  'inutilizada',
  'pendente',
  'processando',
  'erro',
]);

export const consultaChaveSchema = z.object({
  chaveAcesso: chaveAcessoSchema,
});

export const consultaCNPJSchema = z.object({
  cnpj: cnpjSchema,
  tipo: z.enum(['emitidas', 'recebidas', 'todas']).optional().default('todas'),
  dataInicio: z.string().datetime().optional(),
  dataFim: z.string().datetime().optional(),
  pagina: z.number().int().min(1).optional().default(1),
  limite: z.number().int().min(1).max(100).optional().default(20),
});

export type ConsultaChaveInput = z.infer<typeof consultaChaveSchema>;
export type ConsultaCNPJInput = z.infer<typeof consultaCNPJSchema>;
