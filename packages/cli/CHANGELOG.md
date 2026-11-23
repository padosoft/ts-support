# @padosoft/cli

## 1.7.0

### Minor Changes

- [#80](https://github.com/padosoft/ts-support/pull/80) [`17957bf`](https://github.com/padosoft/ts-support/commit/17957bfea3939a8442ef8d5110109d131af129a4) Thanks [@47PADO47](https://github.com/47PADO47)! - Release foundation for tag-driven app releases, and bun-only, Codemod-based stacks.
  
  - `padosoft release check-tag <tag>`: the release workflows' guard. Parses `vX.Y.Z`, `vX.Y.Z-preview.N`, `<app>@vX.Y.Z` and `<app>@vX.Y.Z-preview.N`; checks the tag commit is on `origin/<prod-branch>` (production) or `origin/<preview-branch>` / any branch (preview), and that a production tag matches the apps' `package.json` version; prints `profile=`, `version=`, `apps=` for `$GITHUB_OUTPUT`.
  - `padosoft release tag [patch|minor|major] [--preview] [--apps a,b] [--dry-run]`: bumps the apps to one version, commits `chore(release): vX.Y.Z`, tags and pushes; with changesets and no bump it tags the current version; `--preview` tags the next version's `-preview.N` without touching `package.json`; `--apps` tags `<app>@v…` per app.
  - `padosoft release apps` now tags `v<version>` when the repo has one app or all apps share one version (one GitHub Release with a section per app), and supports a single-app repo released from its root `package.json`. `--tag-format name` keeps the previous `<name>@<version>` tags.
  - `padosoft stack doctor` fails on npm, yarn or pnpm lockfiles and on a root `package.json` whose `packageManager` is missing or not `bun@…` (JS projects only).
  - `padosoft stack migrate` runs migrations that are Codemod packages (a `workflow.yaml`) with `bunx codemod@1.18.7 workflow run`, analytics off; `codemod.{mjs,js,ts}` still works. `padosoft stack validate` runs `codemod jssg test` for Codemod packages with a `tests/` folder.

## 1.6.0

### Minor Changes

- [#79](https://github.com/padosoft/ts-support/pull/79) [`a8c70c1`](https://github.com/padosoft/ts-support/commit/a8c70c1463a972e440567f765810fdc4ea18d652) Thanks [@47PADO47](https://github.com/47PADO47)! - Add `padosoft stack` and `padosoft agents setup`: keep projects on a shared stack read from a separate stacks source (local folder or cached git clone), with only the project's state in `.padosoft/stack.json`.
  
  - `stack status | context | skill | plan` read the project's stacks, rules, skills and pending migrations; `stack context --if-present` is meant for agent session hooks.
  - `stack init | apply` create a project and apply recipes (packages, files, JSON merges), recording the choices and features they stand for.
  - `stack migrate | verify | mark` run migrations: package changes and a codemod, the agent's manual steps, verify commands, then the manifest update.
  - `stack doctor` fails on drift (for CI); `stack validate` checks a whole stacks source.
  - `agents setup` wires the context into Claude Code (SessionStart hook), Codex and Gemini CLI (global instructions).
  - Axes can describe when to pick each option (shown by `stack init`), and stacks can override inherited defaults (last stack wins). In Expo projects, runtime packages are added with `expo install`.
  - JSON Schemas for the manifest, `stack.json`, `recipe.json` and `migration.json` ship in `schema/`.

### Patch Changes

- Updated dependencies [[`7e6df57`](https://github.com/padosoft/ts-support/commit/7e6df571fe59ae797504cb4bb9dac8668ee8a710)]:
  - @padosoft/utilities@1.13.0

## 1.5.0

### Minor Changes

- [#74](https://github.com/padosoft/ts-support/pull/74) [`f4f6ac9`](https://github.com/padosoft/ts-support/commit/f4f6ac997c50a96ce5d9e71653b2a0d15acf9496) Thanks [@47PADO47](https://github.com/47PADO47)! - Nuovo comando `padosoft styles-contract gen`: estrae staticamente (solo AST, via `oxc-parser`) ogni chiamata `fn(path, defaults, options?)` e genera un contratto tipizzato (`path → slot`) più i default per call site, con `--check` per la CI. Pensato per i layer di override di stile/tema (es. `useStyleOverride`), con `--minify` per output compatto, configurabile per funzione, namespace dei path, chiave delle varianti ed espressioni opache (`Platform.select`, `StyleSheet`).

### Patch Changes

- [#72](https://github.com/padosoft/ts-support/pull/72) [`fff12ae`](https://github.com/padosoft/ts-support/commit/fff12ae4c10008dd7daa7283d6a9706a43b9a83d) Thanks [@47PADO47](https://github.com/47PADO47)! - Il bin si chiama `padosoft`, come documentato nel README (prima era installato come `cli`).

- Updated dependencies [[`f4f6ac9`](https://github.com/padosoft/ts-support/commit/f4f6ac997c50a96ce5d9e71653b2a0d15acf9496)]:
  - @padosoft/config@1.5.1

## 1.4.0

### Minor Changes

- [#70](https://github.com/padosoft/ts-support/pull/70) [`090ff08`](https://github.com/padosoft/ts-support/commit/090ff08342cba2bab6835f7beadf03fd40e33075) Thanks [@47PADO47](https://github.com/47PADO47)! - `@padosoft/cli`: add `build bump`, `build check`, `build reset` and `release apps` commands (ported from the gescat mobile app scripts) for managing Expo app build numbers against EAS and tagging/releasing apps from their changesets CHANGELOG.

  `expo update` now defaults to the `latest` dist-tag (was `canary`) and, when `--tag` is omitted on an interactive terminal, prompts for `latest`, `next`, `canary` or a custom tag.

  Fix npm version lookups (`expo update`, `dep add`) silently resolving nothing on Windows.

  `@padosoft/utilities`: add runtime-agnostic `lib/build-number` (`computeVersionCode`, `incrementBuildNumber`, `resetBuildNumber`, `computeBuildVersions`) and `lib/changelog` (`extractChangelogSection`), plus `mapLimit` in `lib/promise`. Add Node-only subpath modules, kept out of the barrels: `lib/process` (`run`, `runOrThrow`, `runCommand`, `spawnProcess`, `toShellCommand`), `lib/git`, `lib/github`, `lib/npm` (`getTaggedVersion`), `lib/workspace` (`readWorkspacePackages`) and `lib/json-file`.

### Patch Changes

- Updated dependencies [[`090ff08`](https://github.com/padosoft/ts-support/commit/090ff08342cba2bab6835f7beadf03fd40e33075)]:
  - @padosoft/utilities@1.12.0

## 1.3.1

### Patch Changes

- [`8b57182`](https://github.com/padosoft/ts-support/commit/8b5718298d0f8a6c2350eb23ecb6e1732c1b1a87) Thanks [@47PADO47](https://github.com/47PADO47)! - Fix sade variadic arg collection for all `[packages...]` / `[paths...]` commands.

  Sade only shifts one positional into the action for variadic optional args — the rest land in `opts._`. Without the fix, `dep add` with no args crashed with a TypeError, passing `pkg@latest` iterated over individual characters (producing `@@latest` errors), and multiple packages were silently dropped. The same bug affected `sync editor`, `init biome`, `init tsconfig`, `init tsdown`, and `i18n extract`.

## 1.3.0

### Minor Changes

- [#33](https://github.com/padosoft/ts-support/pull/33) [`d5ebec8`](https://github.com/padosoft/ts-support/commit/d5ebec8c27f3d9afa16f3a3ee15eb29945c8babd) Thanks [@47PADO47](https://github.com/47PADO47)! - Add three monorepo management commands: `dep add`, `expo update`, and `i18n extract`.

  - `dep add [packages...]` — adds packages to the workspace catalog and wires `catalog:` refs to all `apps/` and/or `packages/` members; supports `--tag`, `--scope`, `--dry-run`, `--install`
  - `expo update` — batch-updates all Expo packages (`expo`, `expo-*`, `@expo/*`) in the current workspace to a specified npm dist-tag (default: `canary`); handles `dependencies`, `devDependencies`, `overrides`, `workspaces.catalog`, and `patchedDependencies` keys
  - `i18n extract [paths...]` — extracts flat dot-notation translation keys from any locale file via dynamic import; supports `--format array|object`, `--file`, and `--table`

  Add `utils/workspace.ts` with shared utilities: `readJSON`, `writeJSON`, `runCommand`, `formatFile`, `parsePackageSpec`, `getTaggedVersion`, `sortDeps`, `mapLimit`.

### Patch Changes

- [#36](https://github.com/padosoft/ts-support/pull/36) [`340c2e5`](https://github.com/padosoft/ts-support/commit/340c2e549fd97a36918e53d612217533e4c626d6) Thanks [@47PADO47](https://github.com/47PADO47)! - Re-publish with properly resolved workspace dependencies (`workspace:^` → real semver) now that the CI pipeline uses `bun pm pack`.

- Updated dependencies [[`340c2e5`](https://github.com/padosoft/ts-support/commit/340c2e549fd97a36918e53d612217533e4c626d6)]:
  - @padosoft/config@1.3.2
  - @padosoft/utilities@1.5.1

## 1.2.0

### Minor Changes

- [#32](https://github.com/padosoft/ts-support/pull/32) [`b8068c4`](https://github.com/padosoft/ts-support/commit/b8068c410a773cf4c732d9f812be6d347c81de49) Thanks [@47PADO47](https://github.com/47PADO47)! - Add `chalk` utility built on `node:util` `styleText`.

  - `@padosoft/utilities`: new `./lib/chalk` subpath export — a chainable, proxy-based `chalk` instance backed by Node's native `styleText` (auto-respects `NO_COLOR`/`FORCE_COLOR`)
  - `@padosoft/logger`: console transport colors now use `chalk` instead of raw ANSI escape codes
  - `@padosoft/cli`: CLI output (skip/write/create/error) is now colorized via `chalk`

### Patch Changes

- Updated dependencies [[`b8068c4`](https://github.com/padosoft/ts-support/commit/b8068c410a773cf4c732d9f812be6d347c81de49)]:
  - @padosoft/utilities@1.5.0

## 1.1.0

### Minor Changes

- [#26](https://github.com/padosoft/ts-support/pull/26) [`5679698`](https://github.com/padosoft/ts-support/commit/5679698c3e0e3a868d3b8d4037df70747e45a643) Thanks [@47PADO47](https://github.com/47PADO47)! - Add `@padosoft/cli` package with `padosoft` binary for scaffolding in @padosoft monorepos.

  Commands:

  - `padosoft new package --name <n> --type ts|rn [--scope @myorg]` — scaffold a new ts-support or rn-support package with package.json, tsconfig, tsdown config, and src/index.ts
  - `padosoft new component --name <n> --pkg <pkg> [--variants]` — create a NativeWind-styled RN component (with optional CVA variants)
  - `padosoft new hook --name <n> --pkg <pkg>` — create a typed React hook stub
  - `padosoft changeset --pkg <pkg> --type major|minor|patch --message <msg>` — create a changeset file

  Uses `sade` for argument parsing. All commands write files relative to `cwd` (monorepo root).
