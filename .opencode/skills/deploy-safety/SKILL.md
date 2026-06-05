---
name: deploy-safety
description: Use when preparing a production deploy for DFeCentral. Keeps deploys isolated, verified locally, and safe for the Oracle VM.
---

# Deploy Safety

- Confirm the change is limited to the intended files.
- Run the relevant local verification first, usually `npm run build` and `npm run lint`.
- Do not deploy with unrelated uncommitted changes.
- Prefer a single focused commit for the deployable fix.
- If the change affects API, web, or shared runtime code, verify the production-facing path locally before deploy.
- Keep SEFAZ and certificate flow untouched unless the task explicitly targets it.
