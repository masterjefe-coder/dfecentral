CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_documento') THEN
    CREATE TYPE status_documento AS ENUM (
      'autorizada',
      'cancelada',
      'denegada',
      'inutilizada',
      'pendente',
      'processando',
      'erro'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_documento') THEN
    CREATE TYPE tipo_documento AS ENUM (
      'nfe',
      'nfce',
      'nfse',
      'cte',
      'mdfe',
      'bpe',
      'cteos',
      'dce'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "usuarios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar(255) NOT NULL UNIQUE,
  "nome" varchar(200) NOT NULL,
  "senha_hash" varchar(255) NOT NULL,
  "cnpj" varchar(14),
  "cnpj_ativo" varchar(14),
  "plano" varchar(20) NOT NULL DEFAULT 'free',
  "api_key" varchar(64) UNIQUE,
  "consultas_mes" numeric(10,0) NOT NULL DEFAULT 0,
  "preferencias" jsonb DEFAULT '{}'::jsonb,
  "criado_em" timestamptz NOT NULL DEFAULT now(),
  "atualizado_em" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "documentos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chave_acesso" varchar(56) NOT NULL UNIQUE,
  "tipo" tipo_documento NOT NULL,
  "numero" varchar(20) NOT NULL,
  "serie" varchar(10) NOT NULL,
  "data_emissao" timestamptz NOT NULL,
  "cnpj_emitente" varchar(14) NOT NULL,
  "razao_social_emitente" varchar(200),
  "cnpj_destinatario" varchar(14),
  "razao_social_destinatario" varchar(200),
  "valor_total" numeric(15,2),
  "status" status_documento NOT NULL DEFAULT 'pendente',
  "xml_completo" jsonb,
  "metadados" jsonb,
  "criado_em" timestamptz NOT NULL DEFAULT now(),
  "atualizado_em" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "consultas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" uuid REFERENCES "usuarios"("id"),
  "tipo" varchar(20) NOT NULL,
  "consulta" varchar(255) NOT NULL,
  "resultado" varchar(20) NOT NULL,
  "ip" varchar(45),
  "criado_em" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "empresas_usuario" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" uuid NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
  "nome" varchar(200) NOT NULL,
  "cnpj" varchar(14) NOT NULL,
  "criado_em" timestamptz NOT NULL DEFAULT now(),
  "atualizado_em" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_documentos_cnpj_emitente" ON "documentos" ("cnpj_emitente");
CREATE INDEX IF NOT EXISTS "idx_documentos_cnpj_destinatario" ON "documentos" ("cnpj_destinatario");
CREATE INDEX IF NOT EXISTS "idx_documentos_data_emissao" ON "documentos" ("data_emissao");
CREATE INDEX IF NOT EXISTS "idx_documentos_tipo" ON "documentos" ("tipo");
CREATE INDEX IF NOT EXISTS "idx_documentos_status" ON "documentos" ("status");
CREATE INDEX IF NOT EXISTS "idx_consultas_usuario_id" ON "consultas" ("usuario_id");
CREATE INDEX IF NOT EXISTS "idx_consultas_criado_em" ON "consultas" ("criado_em");
CREATE INDEX IF NOT EXISTS "idx_empresas_usuario_id" ON "empresas_usuario" ("usuario_id");
CREATE INDEX IF NOT EXISTS "idx_empresas_cnpj" ON "empresas_usuario" ("cnpj");
