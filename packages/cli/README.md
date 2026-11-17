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

### `contract gen`

Statically extracts every call of a function shaped like `fn(path, defaults, options?)` and generates a typed **contract** from them. It is meant for apps that let a theme or a white-label layer override component styles: components declare their defaults at the call site (`useStyleOverride("button", defaults)`), and the contract tells the override layer which paths and slots exist, so unknown paths or slots become TypeScript errors instead of silently dead keys.

```
padosoft contract gen --fn <name> [--src dirs] [--out dir] [--name Contract] [--check]
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
| `--no-format` | — | Skip formatting with the project's Biome |

**Example:**

```bash
padosoft contract gen --fn useStyleOverride   --src packages/core/src,packages/ui/src   --out packages/ui/src/style-contract   --name StyleContract --namespaces components,screens

# in CI: fail if someone changed a default without regenerating
padosoft contract gen --fn useStyleOverride ... --check
```

**What it understands** (no type checker, only the AST, so it is fast): the path as a string literal, as an identifier typed with a union alias of string literals declared in the same file, or as a template over such identifiers; defaults as an object literal or a `const` of the same file or of a relative import, with `as` / `satisfies` / spreads / simple arithmetic. Any call it cannot resolve is reported with `file:line` and the command fails — the contract never has holes.

**Output** in `--out`:

| File | Description |
|---|---|
| `contract.generated.ts` | Self-contained: `<name>` (path → slots, union of the shapes at every call site), `<name>Json`, `<name>Object` and the variant-paths union |
| `defaults.generated.json` | Per path, the defaults of every call site (`file` + `defaults`) — documentation for theme authors and the baseline for parity tests |

Files are formatted with the Biome found in `node_modules/.bin` (searched upwards from the current directory), so they pass `biome check`.

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
