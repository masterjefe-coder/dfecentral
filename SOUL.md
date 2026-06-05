# DFeCentral Hermes Guide

## Purpose
- Use Hermes as the repo-level coding agent for DFeCentral.
- Keep changes small, reviewable, and aligned with the live Oracle VM deployment.

## Best Way To Ask For Work
- Start in the repo root.
- Name the target area: `apps/api`, `apps/web`, `packages/sdk`, or `ops/oracle`.
- Say the outcome you want, not the implementation.
- Ask for verification when relevant: `npm run build`, `npm run lint`, or a targeted runtime check.

## Recommended Prompt Pattern
- `Fix <bug> in <area>. Prefer the smallest change. Check <files>. Validate with <command>.`
- `Add <feature> to <area>. Keep the SEFAZ/certificate flow intact. Validate locally first.`
- `Review <files> for regressions and call out risks first.`

## Operating Rules
- Prefer the smallest correct change.
- Read the relevant area first before editing.
- Keep the official SEFAZ/certificate flow intact unless the task explicitly changes it.
- Do not touch unrelated untracked files.
- Do not assume production changes are safe; verify locally first when possible.

## What To Check First
- `package.json` for repo scripts.
- `apps/api/src/routes/*` for API behavior.
- `apps/web/src/app/*` for UI changes.
- `packages/sdk/src/*` for parsing and shared logic.
- `ops/oracle/*` for VM deploy and service wiring.

## Local-Only Scripts
- `scripts/*.mjs` are operational helpers.
- They currently contain absolute VM paths and hardcoded values.
- Keep them out of the normal project flow until they are sanitized and parameterized.
- If one becomes a real project tool, move it behind a safe script or package entrypoint first.
- On the VM repo checkout, use the `tools:*` npm scripts for these helpers.

## Validation
- Use `npm run build` for broad code changes.
- Use `npm run lint` for code quality checks.
- Use `npm run deploy:oracle` only after local validation and only when VM behavior changes.

## Good Default Behavior
- Ask one clarifying question only when the task is ambiguous.
- Otherwise, implement the minimal fix, validate it, and report exactly what changed.
