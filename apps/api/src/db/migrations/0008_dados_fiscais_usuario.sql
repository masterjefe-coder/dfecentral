ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS razao_social varchar(200),
  ADD COLUMN IF NOT EXISTS nome_fantasia varchar(200),
  ADD COLUMN IF NOT EXISTS ie varchar(30),
  ADD COLUMN IF NOT EXISTS uf varchar(2),
  ADD COLUMN IF NOT EXISTS municipio varchar(120),
  ADD COLUMN IF NOT EXISTS regime_tributario varchar(20),
  ADD COLUMN IF NOT EXISTS telefone varchar(30),
  ADD COLUMN IF NOT EXISTS email_fiscal varchar(255),
  ADD COLUMN IF NOT EXISTS responsavel varchar(200);
