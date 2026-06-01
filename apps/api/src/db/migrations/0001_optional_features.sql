CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "usuarios"
ADD COLUMN IF NOT EXISTS "cnpj_ativo" varchar(14),
ADD COLUMN IF NOT EXISTS "preferencias" jsonb DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS "empresas_usuario" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" uuid NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
  "nome" varchar(200) NOT NULL,
  "cnpj" varchar(14) NOT NULL,
  "criado_em" timestamptz NOT NULL DEFAULT now(),
  "atualizado_em" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_empresas_usuario_id" ON "empresas_usuario" ("usuario_id");
CREATE INDEX IF NOT EXISTS "idx_empresas_cnpj" ON "empresas_usuario" ("cnpj");

CREATE INDEX IF NOT EXISTS "idx_consultas_usuario_id" ON "consultas" ("usuario_id");
CREATE INDEX IF NOT EXISTS "idx_consultas_criado_em" ON "consultas" ("criado_em");
