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
