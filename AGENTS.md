# DFeCentral Agent Notes

## Scope
- Monorepo for DFeCentral, a fiscal document platform for Brazil.
- Main apps: `apps/api`, `apps/web`, `apps/consulta`, `apps/scraper`.
- Shared code lives in `packages/sdk` and `packages/shared`.

## Production Topology
- Oracle VM deploy path: `/opt/apps/dfecentral`.
- Services on VM:
  - `dfecentral-web` on `3003`
  - `dfecentral-api` on `3004`
  - `dfecentral-consulta` on `3005`
  - `dfecentral-scraper` on `3100`
- Web/API/Consulta use `/opt/apps/dfecentral/shared/app.env`.

## Working Rules
- Prefer small, minimal changes.
- Keep the official SEFAZ/certificate flow intact unless the task is explicitly about changing it.
- Do not touch unrelated untracked files.
- Do not assume production changes are safe; verify locally first when possible.

## What To Check First
- `package.json` for repo scripts.
- `apps/api/src/routes/*` for API behavior.
- `apps/web/src/app/*` for UI changes.
- `packages/sdk/src/*` for document parsing and shared logic.
- `ops/oracle/*` for VM deploy and service wiring.

## Hermes Workflow
- Start from the repo root so Hermes loads this file automatically.
- Prefer the smallest change that fixes the problem.
- When investigating, read the relevant app area first and avoid broad edits.
- Use `npm run build` and `npm run lint` before touching production deploy steps.
- Use `npm run deploy:oracle` only after local validation when the change affects the VM.
- For API work, check `apps/api/src/routes/*` first.
- For UI work, check `apps/web/src/app/*` first.
- For shared parsing or document logic, check `packages/sdk/src/*` first.
- For service wiring or deploy behavior, check `ops/oracle/*` first.
- See `SOUL.md` for the recommended way to ask Hermes for work in this repo.

## Local-Only Scripts
- `scripts/*.mjs` are ad-hoc operational helpers.
- They currently contain absolute VM paths and hardcoded values, so treat them as local-only.
- Do not commit or generalize them unless they are sanitized and parameterized first.
- On the VM repo checkout, prefer the `tools:*` npm scripts for these helpers.

## Useful Commands
- `npm run build`
- `npm run lint`
- `npm run deploy:oracle`

## Notes
- The repo is already deployed to production and runs multiple services on the same VM.
- Be careful with deploy and service changes; keep them isolated and easy to rollback.
