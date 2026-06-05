---
name: architecture-compliance
description: Use when changing DFeCentral structure, boundaries, or shared logic. Keeps edits aligned with repo workflow, API/web separation, and SEFAZ/certificate constraints.
---

# Architecture Compliance

- Read `AGENTS.md`, `SOUL.md`, and the relevant package area before editing.
- Prefer the smallest correct change.
- Keep API, web, SDK, and deploy concerns separated.
- Do not alter SEFAZ or certificate flow unless the task explicitly requires it.
- Do not touch unrelated files or untracked work.
- For shared logic, prefer `packages/sdk` or `packages/shared` over duplicating code.
- For production-facing changes, validate locally before any deploy step.
