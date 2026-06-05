---
name: tdd-enforcer
description: Use when implementing a feature or fixing a bug in DFeCentral and you want tests written before code. Enforces a test-first workflow.
---

# TDD Enforcer

- Write or update the relevant test first.
- Keep the test focused on the behavior that matters.
- Implement the smallest code change that makes the test pass.
- Run the smallest useful verification command first, then the broader build if needed.
- If the repo has no nearby tests, add the lightest regression check that fits the area.
- Do not skip verification unless the user explicitly asks for a code-only change.
