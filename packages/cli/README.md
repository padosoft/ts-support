# @padosoft/cli

`padosoft` — a lightweight CLI for scaffolding packages and syncing shared tooling config across `@padosoft` monorepos and standalone repositories.

Built with [`sade`](https://github.com/lukeed/sade) for minimal overhead with a clean, ergonomic command interface.

## Install

```bash
# Global install
bun add -g @padosoft/cli

# Or run without installing
bunx @padosoft/cli <command>
```

The binary is exposed as `padosoft`.

## Commands

### `new package`

Scaffolds a new publishable package inside `packages/<name>/` of the current directory.

```
padosoft new package --name <name> [--type ts|rn] [--scope @myorg]
```

| Option | Alias | Default | Description |
|---|---|---|---|
| `--name` | `-n` | — | Package name without scope (required) |
| `--type` | `-t` | `ts` | `ts` for a plain TypeScript package, `rn` for React Native / Expo |
| `--scope` | `-s` | `@padosoft` | npm scope to prefix the package name |

**Examples:**

```bash
# TypeScript library
padosoft new package --name my-lib --type ts

# React Native package under a custom scope
padosoft new package --name rn-utils --type rn --scope @myorg
```

**What gets created** under `packages/<name>/`:

| File | Description |
|---|---|
| `package.json` | Correct name, `type: "module"`, `tsdown` build script, peer deps (rn only) |
| `tsconfig.json` | Extends `@padosoft/config/typescript/compiler` |
| `tsdown.config.ts` | Pre-configured `tsdown` build, unbundled, with exports |
| `src/index.ts` | Empty barrel export |

For `--type rn` the `package.json` includes `react`, `react-native`, and `expo` as both `devDependencies` and `peerDependencies`.

---

### `sync editor`

Copies `.vscode/settings.json` and `.zed/settings.json` from `@padosoft/config` into one or more repository directories.

```
padosoft sync editor [paths...] [--force]
```

| Option | Alias | Default | Description |
|---|---|---|---|
| `--force` | `-f` | `false` | Overwrite existing files |

Omitting `[paths...]` targets the current working directory.

**Examples:**

```bash
# Sync editor settings into the current repo
padosoft sync editor

# Sync into multiple repos at once, overwriting existing files
padosoft sync editor ~/repos/app-a ~/repos/app-b --force
```

---

### `init biome`

Writes a `biome.json` that extends `@padosoft/config/tools/biome` into one or more directories. This is a one-time bootstrapping operation — run it once when setting up a new repo.

```
padosoft init biome [paths...] [--force]
```

| Option | Alias | Default | Description |
|---|---|---|---|
| `--force` | `-f` | `false` | Overwrite existing `biome.json` |

**Examples:**

```bash
# Add biome.json to the current repo
padosoft init biome

# Bootstrap biome config in two repos at once
padosoft init biome ~/repos/app-a ~/repos/app-b
```

Generated `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.1/schema.json",
  "extends": ["@padosoft/config/tools/biome"]
}
```

---

### `init tsconfig`

Writes a `tsconfig.json` that extends a `@padosoft/config` TypeScript preset into one or more directories. Run once when bootstrapping a new repo.

```
padosoft init tsconfig [paths...] [--preset base|compiler|expo|hono] [--force]
```

| Option | Alias | Default | Description |
|---|---|---|---|
| `--preset` | `-p` | `base` | Config preset to extend |
| `--force` | `-f` | `false` | Overwrite existing `tsconfig.json` |

**Presets:**

| Preset | Extends | Intended for |
|---|---|---|
| `base` | `@padosoft/config/typescript/base` | General TypeScript projects |
| `compiler` | `@padosoft/config/typescript/compiler` | Library packages built with tsdown |
| `expo` | `@padosoft/config/typescript/expo` | Expo / React Native apps |
| `hono` | `@padosoft/config/typescript/hono` | Hono API servers |

**Examples:**

```bash
# Add tsconfig.json with the compiler preset to the current dir
padosoft init tsconfig --preset compiler

# Bootstrap expo preset in two app repos
padosoft init tsconfig ~/repos/app-a ~/repos/app-b --preset expo
```

Generated `tsconfig.json` (e.g. `--preset compiler`):

```json
{
  "extends": "@padosoft/config/typescript/compiler"
}
```

---

### `expo update`

Updates every Expo package (`expo`, `expo-*`, `@expo/*`, `*-expo`) in the current `package.json` — `dependencies`, `devDependencies`, `overrides`, the workspace `catalog` and `patchedDependencies` keys — to the version behind an npm dist-tag. Entries using `catalog:` are skipped (the catalog itself is updated).

```
padosoft expo update [--tag <tag>] [--exclude a,b]
```

| Option | Alias | Default | Description |
|---|---|---|---|
| `--tag` | `-t` | `latest` | npm dist-tag. Without it, a TTY prompts for one (see below) |
| `--exclude` | `-e` | `expo-atlas,expo-quick-actions` | Comma-separated packages to skip |

Without `--tag`, an interactive terminal asks which tag to use — Enter picks `latest`:

```
? Which npm dist-tag should Expo packages be updated to?
  1) latest   stable release (default)
  2) next     upcoming release / release candidate
  3) canary   nightly builds
  4) custom…  any other dist-tag, e.g. beta
```

In CI or when stdin is not a TTY there is no prompt and `latest` is used.

---

### `build bump` / `build check` / `build reset`

Manage the `buildNumber` of Expo apps living in `apps/<app>/` (versionCode math from `@padosoft/utilities/lib/build-number`) (iOS build number / Android versionCode), for monorepos that keep `version` + `buildNumber` in each app's `package.json`.

```
padosoft build bump <app>  [--format <f>] [--apps-dir apps]
padosoft build check <app> [--auto-increment] [--platform ios|android] [--format <f>] [--apps-dir apps]
padosoft build reset       [--apps-dir apps]
```

| Command | What it does |
|---|---|
| `build bump` | Increments `buildNumber` according to the app's build code format |
| `build check` | Lists the app's EAS builds (`eas build:list`) and fails if the current version + buildNumber was already used. With `--auto-increment` it bumps until unique and writes the result |
| `build reset` | Run after `changeset version`: `sequential` apps restart at `0`, `yearly`/`date` apps are bumped (their versionCode is not semver-aware) |

**Build code formats** (Android versionCode):

| Format | versionCode | Notes |
|---|---|---|
| `sequential` | `(major*10000 + minor*100 + patch) * 10 + buildNumber` | Up to 10 builds (0-9) per semver |
| `yearly` | `YYYY * 1000 + buildNumber` | `buildNumber` restarts at 1 every year |
| `date` | `YYYYMMDD` | `buildNumber` is today's date |

The format is resolved from, in order: `--format`, a `buildCodeFormat` field in the app's `package.json`, the `buildCodeFormat` of the default export of `apps/<app>/src/config/index.{ts,js,mjs}`, then `sequential`. Importing a TypeScript config with extensionless imports needs Bun (`bunx --bun padosoft …`); if the import fails the command stops instead of guessing.

```bash
# in apps/<app>/package.json
"build:prod": "padosoft build check my-app --auto-increment && eas build --profile production"

# root package.json
"version-packages": "changeset version && padosoft build reset && bun i --lockfile-only"
```

---

### `release apps`

Tags every app in `apps/*` at its current version as `<name>@<version>`, pushes the tag and creates the matching GitHub Release, with that version's section of `apps/<app>/CHANGELOG.md` as notes. Run it after the changesets "version packages" PR merges.

```
padosoft release apps [--dry-run] [--apps-dir apps]
```

Idempotent: a tag already on `origin` is never moved and an existing release is never recreated. Requires `git` with an `origin` remote and an authenticated `gh` CLI.

---

### `styles-contract gen`

Statically extracts every call of a function shaped like `fn(path, defaults, options?)` and generates a typed **contract** from them. It is meant for apps that let a theme or a white-label layer override component styles: components declare their defaults at the call site (`useStyleOverride("button", defaults)`), and the contract tells the override layer which paths and slots exist, so unknown paths or slots become TypeScript errors instead of silently dead keys.

```
padosoft styles-contract gen --fn <name> [--src dirs] [--out dir] [--name Contract] [--check]
```

| Option | Default | Description |
|---|---|---|
| `--fn, -f` | — | Function whose calls define the contract (required) |
| `--src, -s` | `src` | Directories to scan, comma-separated (or repeat the flag) |
| `--out, -o` | `src/contract` | Output directory |
| `--name, -n` | `Contract` | Name of the generated interface |
| `--variant-type` | `<name>VariantPath` | Name of the generated union of paths that take a variant |
| `--namespaces` | — | Path namespaces, comma-separated. Paths already in one are kept; bare paths get the **first** (`components,screens` turns `button` into `components.button`) |
| `--variant-prop` | `variant` | Property of the options argument that marks a call as taking a variant |
| `--variants-key` | `variants` | Key of the defaults object that holds variants (not a slot) |
| `--opaque` | `Platform.select,StyleSheet` | Expression roots kept as `{ "$expr": "…" }` instead of evaluated |
| `--check, -c` | `false` | Write nothing; exit 1 if the generated files are out of date (CI) |
| `--minify, -m` | `false` | Minified output: single-line JSON, contract without comments or whitespace (implies `--no-format`) |
| `--no-format` | — | Skip formatting with the project's Biome |

**Example:**

```bash
padosoft styles-contract gen --fn useStyleOverride   --src packages/core/src,packages/ui/src   --out packages/ui/src/style-contract   --name StyleContract --namespaces components,screens

# in CI: fail if someone changed a default without regenerating
padosoft styles-contract gen --fn useStyleOverride ... --check
```

**What it understands** (no type checker, only the AST, so it is fast): the path as a string literal, as an identifier typed with a union alias of string literals declared in the same file, or as a template over such identifiers; defaults as an object literal or a `const` of the same file or of a relative import, with `as` / `satisfies` / spreads / simple arithmetic. Any call it cannot resolve is reported with `file:line` and the command fails — the contract never has holes.

**Output** in `--out`:

| File | Description |
|---|---|
| `contract.generated.ts` | Self-contained: `<name>` (path → slots, union of the shapes at every call site), `<name>Json`, `<name>Object` and the variant-paths union |
| `defaults.generated.json` | Per path, the defaults of every call site (`file` + `defaults`) — documentation for theme authors and the baseline for parity tests |

Files are formatted with the Biome found in `node_modules/.bin` (searched upwards from the current directory), so they pass `biome check`.

---

### `stack` — project stacks

Keeps projects on a shared stack (rules, skills, recipes, migrations) without copying any of it into them. The knowledge lives in a separate **stacks source**; a project records only its state in `.padosoft/stack.json`. The CLI knows the formats, never the content.

```
# reading
padosoft stack status   [--json]          # stacks, choices, unset axes, pending migrations, problems
padosoft stack context  [--if-present]    # rules + skills index for this project, as markdown for an agent
padosoft stack skill <name>               # print one skill (its folder path comes first)
padosoft stack plan     [--json]          # pending migrations, in the order to apply them

# changing a project
padosoft stack init --stack <id> [--choice axis=option] [--feature name] [--defaults]
padosoft stack apply <recipe> [--force]   # e.g. feature/otel, styling/uniwind
padosoft stack migrate <id>               # packages + codemod, then prints the manual steps
padosoft stack verify <id>                # the migration's verify commands
padosoft stack mark <id>                  # verify, then record it as applied with the choices it sets

# checking
padosoft stack doctor   [--json]          # exit 1 on drift: for CI
padosoft stack validate                   # check a whole stacks source: for its authors and CI

# once per machine
padosoft agents setup [--agents claude,codex,gemini] [--source <spec>] [--dry-run]
```

Every `stack` command takes `--source <folder|git-url>` (default `$PADOSOFT_STACKS_SOURCE`), `--refresh` and `--offline`. A folder is used as is, which is handy while authoring. A git URL is cloned into `~/.cache/padosoft/stacks` (or `$XDG_CACHE_HOME/padosoft/stacks`) and refreshed when older than 6 hours, using your git credentials; git never prompts, so set up a credential helper (`gh auth login` then `gh auth setup-git`). If a refresh fails, the cached copy is used with a warning. When the source has a `package.json` and a lockfile, its dependencies (what codemods import) are installed after each clone or refresh.

#### Project manifest

`.padosoft/stack.json`, found from the current folder upwards (so each package of a monorepo can have its own):

```json
{
  "$schema": "../node_modules/@padosoft/cli/schema/stack-manifest.json",
  "stacks": ["mobile"],
  "choices": { "lint": "biome", "styling": "uniwind", "list": "legend-list" },
  "features": ["otel"],
  "applied": ["mobile/2026.12-flashlist-to-legend-list"]
}
```

Choices are always explicit: an axis `default` is only proposed by `stack init`, never applied to an existing project, so changing a stack's default never changes what existing projects get. `stack init` records every migration that exists at that moment as applied: a new project starts at the current state of its stacks.

#### Stacks source layout

```
stacks/<stack>/stack.json                         { "extends": ["base"], "axes": { "<axis>": { "options", "descriptions", "default" } }, "defaults": { "<inherited axis>": "<option>" } }
stacks/<stack>/rules/<name>.md                    always included
stacks/<stack>/rules/<axis>/<option>.md           included when choices[axis] = option
stacks/<stack>/rules/feature/<name>.md            included when features contains name
stacks/<stack>/skills/<name>/SKILL.md             Agent Skills format; name must match the folder
stacks/<stack>/recipes/<recipe>/recipe.json       { "title", "deps": { "add", "dev", "remove" }, "merge": { "<file>.json": {...} } }
stacks/<stack>/recipes/<recipe>/files/**          copied into the project
stacks/<stack>/recipes/<recipe>/steps.md          printed for the agent after applying
                                                  <recipe> = init | <axis>/<option> | feature/<name>
stacks/<stack>/migrations/<name>/migration.json   { "title", "kind", "when", "set", "deps", "verify" }
stacks/<stack>/migrations/<name>/codemod.{mjs,js,ts}   run in the project folder ($PADOSOFT_PROJECT_DIR)
stacks/<stack>/migrations/<name>/steps.md         printed by `stack migrate`
```

An axis `descriptions` says when to pick each option: `stack init` shows it in its prompts and, without a terminal, prints it as the list of choices to make (for an agent to relay to the user). A stack `defaults` overrides the default of an inherited axis; when several stacks of a project set one, the last stack listed wins (for example a `web` stack proposing a different linter than a mobile-only project gets).

Rules and recipes are grouped the same way: at the top level they always apply (`init` is the recipe run by `stack init`, one per stack, bases first), under `<axis>/<option>` they belong to that choice, and under `feature/<name>` to that feature. A recipe's path is its name: `stack apply list/legend-list`. Applying a recipe for another option of an axis the project already chose is refused: switching options is a migration. Recipes are idempotent: identical files are skipped, differing files are kept unless `--force`, and JSON merges only add what is missing (objects merge, arrays gain missing items, values are replaced).

Migrations run in name order (use a date prefix) across the stack chain; each required migration's `set` is applied before the next `when` is evaluated, and required migrations can only be applied in that order. Packages are changed with the project's package manager (from the nearest lockfile or `packageManager` field). In a project that depends on `expo`, runtime packages are added with `expo install`, so their versions match the SDK. On Windows, npm, pnpm and yarn run through the shell, so keep package specs to exact or `~` versions there.

`stack doctor` fails on: problems in the stacks or choices, axes with no recorded option, required migrations pending, packages of a chosen recipe that are missing, and packages that belong to another option of a chosen axis.

JSON Schemas for the manifest, `stack.json`, `recipe.json` and `migration.json` ship in `schema/`.

#### Agents

`padosoft agents setup` makes coding agents load `padosoft stack context --if-present` at session start, in their user-level configuration (never in a project): a SessionStart hook in Claude Code's `settings.json`, and a marked instruction block in Codex's `AGENTS.md` and Gemini CLI's `GEMINI.md`. Without `--agents` it sets up the agents whose configuration folder exists; with `--source` the source is baked into the command. Running it again replaces its own hook or block and keeps everything else. Outside a stack project the command prints nothing; if loading fails it prints a note for the agent instead of failing. `padosoft` must be on every agent's PATH (`bun add -g @padosoft/cli`).

---

## Multi-repo patterns

`sync editor` is designed to be re-run whenever `@padosoft/config` updates its editor settings, keeping all repos in sync:

```bash
padosoft sync editor \
  ~/repos/backend \
  ~/repos/mobile \
  ~/repos/web \
  --force
```

`init biome` and `init tsconfig` are one-shot: run them once when creating or onboarding a repo, then let the project own those files:

```bash
padosoft init biome ~/repos/new-service
padosoft init tsconfig ~/repos/new-service --preset hono
```

Files that already exist are skipped unless `--force` is passed. The CLI prints each path it processes:

```
→ /home/user/repos/app-a
  write   /home/user/repos/app-a/.vscode/settings.json
  write   /home/user/repos/app-a/.zed/settings.json

→ /home/user/repos/app-b
  skip    /home/user/repos/app-b/.vscode/settings.json
  write   /home/user/repos/app-b/.zed/settings.json
```

---

## Requirements

- Node.js 20.19+ or Bun 1+
- `@padosoft/config` must be installed alongside this CLI (it is the source of all editor, biome, and tsconfig assets)

## License

MIT
