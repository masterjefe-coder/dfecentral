# Operational Scripts

These scripts are local operational helpers for the DFeCentral VM checkout.

## NPM Commands
- `npm run tools:check-cert-config`
- `npm run tools:delete-cert`
- `npm run tools:find-doc-keys`
- `npm run tools:inspect-certs`
- `npm run tools:migrate-certificate`

The command entrypoints live in `scripts/tools/`.

## Requirements
- Run them on the VM repo checkout or in an environment that can resolve `/opt/apps/dfecentral/repo/...`.
- Keep them out of the normal app flow unless they are explicitly being used for maintenance.

## Environment Variables
- `tools:check-cert-config`:
  - `USER_ID`
  - `CNPJ`
- `tools:delete-cert`:
  - `USER_ID`
  - `CNPJ`
- `tools:find-doc-keys`:
  - `CNPJ`
  - optional `LIMIT`
- `tools:inspect-certs`:
  - `CERT_PASSWORD`
  - `CERT_PATHS` as a comma-separated list
- `tools:migrate-certificate`:
  - `CERT_PATH`
  - `CERT_PASSWORD`
  - `USER_EMAIL`
  - `CNPJ`
  - optional `CERT_NAME`

## Notes
- The scripts intentionally avoid hardcoded user IDs, emails, passwords, and CNPJs.
- They are kept as maintenance helpers, not as application runtime dependencies.
