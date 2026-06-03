import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  decimal,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';

export const statusEnum = pgEnum('status_documento', [
  'autorizada',
  'cancelada',
  'denegada',
  'inutilizada',
  'pendente',
  'processando',
  'erro',
]);

export const tipoDocumentoEnum = pgEnum('tipo_documento', [
  'nfe',
  'nfce',
  'nfse',
  'cte',
  'mdfe',
  'bpe',
  'cteos',
  'dce',
]);

export const documentos = pgTable(
  'documentos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    chaveAcesso: varchar('chave_acesso', { length: 56 }).unique().notNull(),
    tipo: tipoDocumentoEnum('tipo').notNull(),
    numero: varchar('numero', { length: 20 }).notNull(),
    serie: varchar('serie', { length: 10 }).notNull(),
    dataEmissao: timestamp('data_emissao', { withTimezone: true }).notNull(),
    cnpjEmitente: varchar('cnpj_emitente', { length: 14 }).notNull(),
    razaoSocialEmitente: varchar('razao_social_emitente', { length: 200 }),
    cnpjDestinatario: varchar('cnpj_destinatario', { length: 14 }),
    razaoSocialDestinatario: varchar('razao_social_destinatario', { length: 200 }),
    valorTotal: decimal('valor_total', { precision: 15, scale: 2 }),
    status: statusEnum('status').notNull().default('pendente'),
    xmlCompleto: jsonb('xml_completo'),
    metadados: jsonb('metadados'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_documentos_cnpj_emitente').on(table.cnpjEmitente),
    index('idx_documentos_cnpj_destinatario').on(table.cnpjDestinatario),
    index('idx_documentos_data_emissao').on(table.dataEmissao),
    index('idx_documentos_tipo').on(table.tipo),
    index('idx_documentos_status').on(table.status),
  ]
);

export const usuarios = pgTable('usuarios', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  nome: varchar('nome', { length: 200 }).notNull(),
  senhaHash: varchar('senha_hash', { length: 255 }).notNull(),
  cnpj: varchar('cnpj', { length: 14 }),
  cnpjAtivo: varchar('cnpj_ativo', { length: 14 }),
  plano: varchar('plano', { length: 20 }).notNull().default('free'),
  assinaturaStatus: varchar('assinatura_status', { length: 20 }).notNull().default('ativa'),
  assinaturaMetodoPagamento: varchar('assinatura_metodo_pagamento', { length: 20 }).notNull().default('cartao'),
  assinaturaCancelEm: timestamp('assinatura_cancel_em', { withTimezone: true }),
  assinaturaRenovaEm: timestamp('assinatura_renova_em', { withTimezone: true }),
  apiKey: varchar('api_key', { length: 64 }).unique(),
  consultasMes: decimal('consultas_mes', { precision: 10, scale: 0 }).notNull().default('0'),
  preferencias: jsonb('preferencias').default({}),
  criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).defaultNow().notNull(),
});

export const consultas = pgTable(
  'consultas',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    usuarioId: uuid('usuario_id').references(() => usuarios.id),
    tipo: varchar('tipo', { length: 20 }).notNull(),
    consulta: varchar('consulta', { length: 255 }).notNull(),
    resultado: varchar('resultado', { length: 20 }).notNull(),
    ip: varchar('ip', { length: 45 }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_consultas_usuario_id').on(table.usuarioId),
    index('idx_consultas_criado_em').on(table.criadoEm),
  ]
);

export const empresasUsuario = pgTable(
  'empresas_usuario',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    usuarioId: uuid('usuario_id').references(() => usuarios.id).notNull(),
    nome: varchar('nome', { length: 200 }).notNull(),
    cnpj: varchar('cnpj', { length: 14 }).notNull(),
    criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_empresas_usuario_id').on(table.usuarioId),
    index('idx_empresas_cnpj').on(table.cnpj),
  ]
);

export const assinaturasCobrancas = pgTable(
  'assinaturas_cobrancas',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    usuarioId: uuid('usuario_id').references(() => usuarios.id).notNull(),
    plano: varchar('plano', { length: 20 }).notNull(),
    metodoPagamento: varchar('metodo_pagamento', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pendente'),
    origem: varchar('origem', { length: 20 }).notNull().default('assinatura'),
    externalReference: varchar('external_reference', { length: 120 }).unique().notNull(),
    checkoutUrl: varchar('checkout_url', { length: 500 }).notNull(),
    venceEm: timestamp('vence_em', { withTimezone: true }).notNull(),
    pagoEm: timestamp('pago_em', { withTimezone: true }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_assinaturas_cobrancas_usuario_id').on(table.usuarioId),
    index('idx_assinaturas_cobrancas_status').on(table.status),
    index('idx_assinaturas_cobrancas_vence_em').on(table.venceEm),
  ]
);

export const convitesEmpresa = pgTable(
  'convites_empresa',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    usuarioId: uuid('usuario_id').references(() => usuarios.id).notNull(),
    cnpj: varchar('cnpj', { length: 14 }).notNull(),
    nome: varchar('nome', { length: 200 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    papel: varchar('papel', { length: 20 }).notNull().default('membro'),
    token: varchar('token', { length: 128 }).unique().notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pendente'),
    aceitoEm: timestamp('aceito_em', { withTimezone: true }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_convites_empresa_usuario').on(table.usuarioId),
    index('idx_convites_empresa_cnpj').on(table.cnpj),
    index('idx_convites_empresa_email').on(table.email),
    index('idx_convites_empresa_token').on(table.token),
    index('idx_convites_empresa_status').on(table.status),
  ]
);
