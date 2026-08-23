---
"@padosoft/config": patch
---

Split the base tsconfig by TypeScript major so both TS 6 and TS 7 projects work.

The four options deleted in TypeScript 7 (`noImplicitUseStrict`, `noStrictGenericChecks`, `suppressExcessPropertyErrors`, `suppressImplicitAnyIndexErrors`) made every `ts:check` fail with TS5023 under typescript 7.0.2 before any real code was checked. All four were set to `false` (the default), so they are semantically no-ops.

- `@padosoft/config/typescript/base-ts7` — new, holds the shared TS 7-clean option set; destined to become the single base once TS 7 is the norm.
- `@padosoft/config/typescript/base` — now extends `base-ts7` and re-adds only the four TS 6-only options, so projects still on TypeScript 6 keep them set explicitly.

The ready-to-use configs (`compiler`, `hono`, `expo`) now extend `base-ts7` so they stay TS 7-safe; extend `base` directly if you are on TypeScript 6 and want the four options set explicitly.
