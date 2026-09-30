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

The factory sets `dts: true`, `splitting: false`, `treeshake: true`, minification outside watch mode, and `outDir: "dist"` by default, and adds the [`reference-directives`](#reference-directives) plugin after the package's own plugins.

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

#### `reference-directives`

With `isolatedDeclarations`, tsdown generates declarations with Oxc, which drops triple-slash reference directives. This rolldown plugin puts back the ones marked `preserve="true"`, as `tsc` does, collecting them from every module bundled into each declaration file:

```ts
// src/types/nativewind.ts
/// <reference types="nativewind/types" preserve="true" />
```

```ts
// dist/types/nativewind.d.mts
/// <reference types="nativewind/types" preserve="true" />
export {}
```

- Directives without `preserve="true"` are left out, as `tsc` leaves them out since TypeScript 5.5, so dev-only references don't leak into published types.
- `path` references are rebased on the output file. The file they point to must be published too (e.g. by shipping `src`).

The `tsdown` factory already includes it. Other tsdown configs can add it directly:

```ts
import { referenceDirectives } from "@padosoft/config/compiler/plugins/reference-directives";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  dts: true,
  plugins: [referenceDirectives()],
});
```

### TypeScript type declarations

Import ambient declarations for CSS modules, NativeWind, Expo Router, and i18next.

Expo apps don't need `types/css`: `expo/types` (loaded by `expo-env.d.ts`) already declares CSS modules, and loading both makes TypeScript report `Duplicate identifier 'classes'`.

```ts
// In your tsconfig.json types array or a .d.ts file:
import "@padosoft/config/types/css";
import "@padosoft/config/types/nativewind";
import "@padosoft/config/types/expo-router";
import "@padosoft/config/types/i18next";
```

#### i18next

`@padosoft/config/types/i18next` types i18next's `t()` keys, interpolation values and `i18n.language` from an `I18nConfig` interface that you augment:

```ts
// src/types/i18n.d.ts
import "@padosoft/config/types/i18next";
import type { common } from "../i18n/locales/en/common";

declare module "@padosoft/config/types/i18next" {
  interface I18nConfig {
    Locale: "en" | "it";
    Translation: { common: typeof common };
  }
}
```

Keep the `import` line: augmenting a module doesn't load it.

Every member is optional:

| Member | Meaning | Default |
|--------|---------|---------|
| `Locale` | Union of supported locale codes (`i18n.language`, `languages`, `resolvedLanguage`) | `string` |
| `Translation` | Resources of one locale, keyed by namespace (i18next `resources`) | not set: any key is accepted |
| `DefaultNS` | i18next `defaultNS` | `keyof Translation` |
| `EnableSelector` | i18next `enableSelector` (`false`, `true`, `"optimize"`, `"strict"`) | `false` |
| `StrictKeyChecks` | i18next `strictKeyChecks` | `false` |

Only the members you declare are passed to i18next's `CustomTypeOptions`, so without an augmentation i18next keeps its default, permissive typing. Other i18next type options can still go on `CustomTypeOptions` directly.

> **`skipLibCheck` hides augmentation errors.** `skipLibCheck: true` skips every `.d.ts` file, your own included. If the augmentation doesn't compile (e.g. TS2717 because a member is declared twice with different types), it's dropped without an error and `t()` falls back to untyped or broken keys. Check the augmentation once with `tsc --noEmit --skipLibCheck false`, or keep it in a `.ts` file.

`@padosoft/rn-i18n` declares its own, separate `I18nConfig` with lowercase members: its `locale` matches `Locale` here, and its `translations` is keyed by locale first, i.e. `Record<Locale, Translation>`. Augment each module you use.

### Export utilities

```ts
import { defaultCustomExports } from "@padosoft/config/compiler/utils/exports";
import { /* helpers */ } from "@padosoft/config/compiler/utils";
```
