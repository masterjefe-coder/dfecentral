CREATE TABLE IF NOT EXISTS certificados_digitais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id),
  cnpj varchar(14) NOT NULL,
  certificado_cnpj varchar(14) NOT NULL,
  nome_arquivo varchar(255) NOT NULL,
  mime_type varchar(120) NOT NULL,
  tamanho_bytes integer NOT NULL,
  validade_em timestamptz NOT NULL,
  arquivo_criptografado text NOT NULL,
  senha_criptografada text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificados_digitais_usuario_id ON certificados_digitais(usuario_id);
CREATE INDEX IF NOT EXISTS idx_certificados_digitais_cnpj ON certificados_digitais(cnpj);
