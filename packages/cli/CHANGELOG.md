# @padosoft/cli

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
