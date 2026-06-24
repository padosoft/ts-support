---
"@padosoft/cli": minor
---

Add `@padosoft/cli` package with `padosoft` binary for scaffolding in @padosoft monorepos.

Commands:
- `padosoft new package --name <n> --type ts|rn [--scope @myorg]` — scaffold a new ts-support or rn-support package with package.json, tsconfig, tsdown config, and src/index.ts
- `padosoft new component --name <n> --pkg <pkg> [--variants]` — create a NativeWind-styled RN component (with optional CVA variants)
- `padosoft new hook --name <n> --pkg <pkg>` — create a typed React hook stub
- `padosoft changeset --pkg <pkg> --type major|minor|patch --message <msg>` — create a changeset file

Uses `sade` for argument parsing. All commands write files relative to `cwd` (monorepo root).
