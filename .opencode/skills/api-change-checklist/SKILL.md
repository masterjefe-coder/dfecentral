---
name: api-change-checklist
description: Use when changing API routes, request schemas, database writes, or auth flows in DFeCentral. Keeps backend changes validated and aligned with existing contracts.
---

# API Change Checklist

- Inspect the route, schema, and DB write path first.
- Keep request and response shapes compatible unless the task explicitly changes them.
- Validate input at the boundary before writing to the database.
- Clamp or normalize values to match storage limits.
- Check auth, permissions, and related web calls that consume the route.
- Run `npm run build` after backend changes.
- Add or update the smallest relevant test or verification step when possible.
