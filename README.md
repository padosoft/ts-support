# ts-support

A monorepo of TypeScript support packages for padosoft projects: shared configurations, typed utilities, a modular logger, React hooks, and typed OpenAPI client helpers.

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@padosoft/config`](packages/config) | [![npm](https://img.shields.io/npm/v/@padosoft/config)](https://www.npmjs.com/package/@padosoft/config) | Shared TypeScript, Biome, and tsdown configurations |
| [`@padosoft/utilities`](packages/utilities) | [![npm](https://img.shields.io/npm/v/@padosoft/utilities)](https://www.npmjs.com/package/@padosoft/utilities) | Typed query helpers, Configuration store, Zod utils, and type helpers |
| [`@padosoft/react`](packages/react) | [![npm](https://img.shields.io/npm/v/@padosoft/react)](https://www.npmjs.com/package/@padosoft/react) | React hooks and HOC utilities (`useConfig`, `composeHOCs`, …) |
| [`@padosoft/logger`](packages/logger) | [![npm](https://img.shields.io/npm/v/@padosoft/logger)](https://www.npmjs.com/package/@padosoft/logger) | Modular logger with transports, plugins, and framework adapters |
| [`@padosoft/openapi-client`](packages/openapi-client) | [![npm](https://img.shields.io/npm/v/@padosoft/openapi-client)](https://www.npmjs.com/package/@padosoft/openapi-client) | Typed base client for openapi-fetch with middleware support |
| [`@padosoft/zod-to-openapi-client`](packages/zod-to-openapi-client) | [![npm](https://img.shields.io/npm/v/@padosoft/zod-to-openapi-client)](https://www.npmjs.com/package/@padosoft/zod-to-openapi-client) | Convert zod-to-openapi route collections into typed openapi-fetch Paths |

## Requirements

- [Bun](https://bun.sh) >= 1.2.20
- Node >= 22.18.0

## Development

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Type-check all packages
bun run ts:check

# Lint
bun run lint
bun run lint:fix
```

## Publishing

Releases are managed with [Changesets](https://github.com/changesets/changesets).

```bash
# 1. Create a changeset describing what changed
bun changeset

# 2. Version packages and publish to npm
bun run publish-packages
```

Changeset bump levels: `patch` for bug fixes, `minor` for new features, `major` for breaking changes. See [CLAUDE.md](CLAUDE.md) for contribution rules.
