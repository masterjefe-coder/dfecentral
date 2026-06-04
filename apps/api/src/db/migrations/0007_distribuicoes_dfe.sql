CREATE TABLE IF NOT EXISTS distribuicoes_dfe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id),
  cnpj varchar(14) NOT NULL,
  tipo varchar(20) NOT NULL DEFAULT 'nfe',
  uf_indice integer NOT NULL DEFAULT 0,
  ult_nsu varchar(15) NOT NULL DEFAULT '000000000000000',
  ultimo_cstat varchar(10),
  ultimo_xmotivo varchar(255),
  proxima_execucao_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_distribuicoes_dfe_usuario_id ON distribuicoes_dfe(usuario_id);
CREATE INDEX IF NOT EXISTS idx_distribuicoes_dfe_cnpj ON distribuicoes_dfe(cnpj);
CREATE INDEX IF NOT EXISTS idx_distribuicoes_dfe_tipo ON distribuicoes_dfe(tipo);
CREATE INDEX IF NOT EXISTS idx_distribuicoes_dfe_proxima_execucao_em ON distribuicoes_dfe(proxima_execucao_em);
