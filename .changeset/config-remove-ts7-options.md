---
"@padosoft/config": patch
---

Remove compiler options deleted in TypeScript 7 (`noImplicitUseStrict`, `noStrictGenericChecks`, `suppressExcessPropertyErrors`, `suppressImplicitAnyIndexErrors`) from the base tsconfig: with typescript 7.0.2 they made every `ts:check` fail with TS5023 before checking any real code. All four were set to `false` (the default), so removing them changes nothing semantically.
