# Oracle Ops

Ferramentas seguras para operar o DFeCentral na VM.

## Comandos recomendados

- `bash /opt/apps/dfecentral/shared/bin/dfecentral-ops.sh status`
- `bash /opt/apps/dfecentral/shared/bin/dfecentral-ops.sh health`
- `bash /opt/apps/dfecentral/shared/bin/dfecentral-ops.sh logs api`
- `bash /opt/apps/dfecentral/shared/bin/dfecentral-ops.sh logs web 200`

## Regra de uso

- Use esses comandos antes de qualquer restart manual.
- Evite mexer em SEFAZ/certificado sem necessidade explícita.
- Para deploys, prefira o fluxo do repositório e valide com build e health depois.
