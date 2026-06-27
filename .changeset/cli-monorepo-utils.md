---
"@padosoft/cli": minor
---

Add three monorepo management commands: `dep add`, `expo update`, and `i18n extract`.

- `dep add [packages...]` — adds packages to the workspace catalog and wires `catalog:` refs to all `apps/` and/or `packages/` members; supports `--tag`, `--scope`, `--dry-run`, `--install`
- `expo update` — batch-updates all Expo packages (`expo`, `expo-*`, `@expo/*`) in the current workspace to a specified npm dist-tag (default: `canary`); handles `dependencies`, `devDependencies`, `overrides`, `workspaces.catalog`, and `patchedDependencies` keys
- `i18n extract [paths...]` — extracts flat dot-notation translation keys from any locale file via dynamic import; supports `--format array|object`, `--file`, and `--table`

Add `utils/workspace.ts` with shared utilities: `readJSON`, `writeJSON`, `runCommand`, `formatFile`, `parsePackageSpec`, `getTaggedVersion`, `sortDeps`, `mapLimit`.
