---
name: dfe-repo-workflow
description: Use when editing DFeCentral code, investigating bugs, preparing builds, or deploying to Oracle. Keeps work aligned with AGENTS.md and SOUL.md.
---

# DFeCentral Workflow

- Read `AGENTS.md` and `SOUL.md` first.
- Check `package.json` before assuming scripts or commands.
- For API work, inspect `apps/api/src/routes/*` and `apps/api/src/db/*` first.
- For web work, inspect `apps/web/src/app/*` and `apps/web/src/components/*` first.
- For shared parsing or document logic, inspect `packages/sdk/src/*` first.
- For deploy and service wiring, inspect `ops/oracle/*` first.
- Prefer the smallest correct change.
- Do not touch unrelated untracked files.
- Keep SEFAZ and certificate flow intact unless the task explicitly changes it.
- Before any production deploy, run `npm run build` and `npm run lint` locally.
- If a change affects production, verify locally before deploying.
