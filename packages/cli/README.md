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

### `sync biome`

Writes a `biome.json` that extends `@padosoft/config/tools/biome` into one or more directories.

```
padosoft sync biome [paths...] [--force]
```

| Option | Alias | Default | Description |
|---|---|---|---|
| `--force` | `-f` | `false` | Overwrite existing `biome.json` |

**Examples:**

```bash
# Add biome.json to the current repo
padosoft sync biome

# Sync biome config into two repos
padosoft sync biome ~/repos/app-a ~/repos/app-b
```

Generated `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.1/schema.json",
  "extends": ["@padosoft/config/tools/biome"]
}
```

---

### `sync tsconfig`

Writes a `tsconfig.json` that extends a `@padosoft/config` TypeScript preset into one or more directories.

```
padosoft sync tsconfig [paths...] [--preset base|compiler|expo|hono] [--force]
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
padosoft sync tsconfig --preset compiler

# Sync expo preset into two app repos
padosoft sync tsconfig ~/repos/app-a ~/repos/app-b --preset expo
```

Generated `tsconfig.json` (e.g. `--preset compiler`):

```json
{
  "extends": "@padosoft/config/typescript/compiler"
}
```

---

## Multi-repo pattern

All `sync` commands accept multiple target paths, making it easy to keep several repositories in sync in a single command:

```bash
padosoft sync editor \
  ~/repos/backend \
  ~/repos/mobile \
  ~/repos/web \
  --force

padosoft sync biome \
  ~/repos/backend \
  ~/repos/mobile \
  ~/repos/web

padosoft sync tsconfig ~/repos/backend --preset hono
padosoft sync tsconfig ~/repos/mobile ~/repos/web --preset expo
```

Files that already exist are skipped unless `--force` is passed. The CLI prints each path it processes so you can see exactly what was written or skipped:

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

- Node.js 18+ or Bun 1+
- `@padosoft/config` must be installed alongside this CLI (it is the source of all editor, biome, and tsconfig assets)

## License

MIT
