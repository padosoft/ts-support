---
"@padosoft/config": patch
---

Split the base tsconfig by TypeScript major so both TS 6 and TS 7 projects work.

The four options deleted in TypeScript 7 (`noImplicitUseStrict`, `noStrictGenericChecks`, `suppressExcessPropertyErrors`, `suppressImplicitAnyIndexErrors`) made every `ts:check` fail with TS5023 under typescript 7.0.2 before any real code was checked, so they are gone from `@padosoft/config/typescript/base` — which is therefore TS 7-ready and stays the single base going forward. All four were set to `false` (the default), so removing them changes nothing semantically.

Projects still on TypeScript 6 that want those options set explicitly can extend the new `@padosoft/config/typescript/base-ts6`, which extends `base` and re-adds the four. (`extends` can add options but not remove them, so the shared foundation has to be the reduced set.)
