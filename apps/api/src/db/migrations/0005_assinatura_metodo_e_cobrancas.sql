ALTER TABLE "usuarios"
ADD COLUMN IF NOT EXISTS "assinatura_metodo_pagamento" varchar(20) NOT NULL DEFAULT 'cartao';

CREATE TABLE IF NOT EXISTS "assinaturas_cobrancas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" uuid NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
  "plano" varchar(20) NOT NULL,
  "metodo_pagamento" varchar(20) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pendente',
  "origem" varchar(20) NOT NULL DEFAULT 'assinatura',
  "external_reference" varchar(120) NOT NULL,
  "checkout_url" varchar(500) NOT NULL,
  "vence_em" timestamptz NOT NULL,
  "pago_em" timestamptz,
  "criado_em" timestamptz NOT NULL DEFAULT now(),
  "atualizado_em" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_assinaturas_cobrancas_external_reference" ON "assinaturas_cobrancas" ("external_reference");
CREATE INDEX IF NOT EXISTS "idx_assinaturas_cobrancas_usuario_id" ON "assinaturas_cobrancas" ("usuario_id");
CREATE INDEX IF NOT EXISTS "idx_assinaturas_cobrancas_status" ON "assinaturas_cobrancas" ("status");
CREATE INDEX IF NOT EXISTS "idx_assinaturas_cobrancas_vence_em" ON "assinaturas_cobrancas" ("vence_em");
