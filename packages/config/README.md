# @padosoft/config

Shared TypeScript, Biome, and tsdown configurations for padosoft packages and apps.

## Installation

```bash
npm install -D @padosoft/config
```

## Contents

### TypeScript configs

Extend any of these base configs in your `tsconfig.json`:

```json
{ "extends": "@padosoft/config/typescript/base" }
{ "extends": "@padosoft/config/typescript/compiler" }
{ "extends": "@padosoft/config/typescript/expo" }
{ "extends": "@padosoft/config/typescript/hono" }
```

### Biome config

```json
{ "extends": ["@padosoft/config/tools/biome"] }
```

### tsdown config factory

Use the `tsdown` helper to get a consistent bundler setup across packages:

```ts
// tsdown.config.ts
import { tsdown } from "@padosoft/config/compiler/tsdown";

export default tsdown({
  entry: ["src/index.ts"],
});
```

The factory sets `dts: true`, `splitting: false`, `treeshake: true`, minification outside watch mode, and `outDir: "dist"` by default.

### Compiler plugins

#### `hono-zod`

A tsdown plugin that handles the hono/zod integration for type generation:

```ts
import { tsdown } from "@padosoft/config/compiler/tsdown";
import { honoZodPlugin } from "@padosoft/config/compiler/plugins/hono-zod";

export default tsdown({
  plugins: [honoZodPlugin()],
});
```

### TypeScript type declarations

Import ambient declarations for CSS modules, NativeWind, Expo Router, and i18next:

```ts
// In your tsconfig.json types array or a .d.ts file:
import "@padosoft/config/types/css";
import "@padosoft/config/types/nativewind";
import "@padosoft/config/types/expo-router";
import "@padosoft/config/types/i18next";
```

### Export utilities

```ts
import { defaultCustomExports } from "@padosoft/config/compiler/utils/exports";
import { /* helpers */ } from "@padosoft/config/compiler/utils";
```
