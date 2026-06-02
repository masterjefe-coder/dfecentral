ALTER TABLE "usuarios"
ADD COLUMN IF NOT EXISTS "assinatura_status" varchar(20) NOT NULL DEFAULT 'ativa',
ADD COLUMN IF NOT EXISTS "assinatura_cancel_em" timestamptz,
ADD COLUMN IF NOT EXISTS "assinatura_renova_em" timestamptz;
