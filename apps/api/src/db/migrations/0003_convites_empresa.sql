CREATE TABLE IF NOT EXISTS "convites_empresa" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" uuid NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
  "cnpj" varchar(14) NOT NULL,
  "nome" varchar(200) NOT NULL,
  "email" varchar(255) NOT NULL,
  "papel" varchar(20) NOT NULL DEFAULT 'membro',
  "token" varchar(128) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pendente',
  "aceito_em" timestamptz,
  "criado_em" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_convites_empresa_usuario" ON "convites_empresa" ("usuario_id");
CREATE INDEX IF NOT EXISTS "idx_convites_empresa_cnpj" ON "convites_empresa" ("cnpj");
CREATE INDEX IF NOT EXISTS "idx_convites_empresa_email" ON "convites_empresa" ("email");
CREATE INDEX IF NOT EXISTS "idx_convites_empresa_token" ON "convites_empresa" ("token");
CREATE INDEX IF NOT EXISTS "idx_convites_empresa_status" ON "convites_empresa" ("status");
