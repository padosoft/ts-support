# @padosoft/utilities

Zero-dependency TypeScript utilities: typed React Query helpers, a reactive `Configuration` store, Zod utilities, and general-purpose type helpers.

## Installation

```bash
npm install @padosoft/utilities
# zod is a required peer dependency
npm install zod
```

## Query helpers

Framework-agnostic utilities for React Query (and any compatible hook library).

### `defineQuery`

Pairs a key factory with a fn factory so call-site params are specified exactly once:

```ts
import { defineQuery } from "@padosoft/utilities/lib/query";

const userQuery = defineQuery({
  queryKey: ({ id }) => ["users", id],
  queryFn: ({ id }) => api.getUser(id),
});

// In a component:
useQuery({ ...userQuery.query({ id: "123" }), staleTime: 60_000 });

// For cache invalidation:
queryClient.invalidateQueries({ queryKey: userQuery.key({ id: "123" }) });
```

### `defineQueryGroup`

Groups related queries under a shared base key; `group.base()` invalidates all of them at once:

```ts
import { defineQueryGroup, defineQuery } from "@padosoft/utilities/lib/query";

const usersQueries = defineQueryGroup({
  baseKey: ["users"],
  queries: {
    single: defineQuery({ queryKey: ({ id }) => [id], queryFn: ({ id }) => api.getUser(id) }),
    list:   defineQuery({ queryKey: (p) => ["list", p], queryFn: (p) => api.listUsers(p) }),
  },
});

usersQueries.base();                        // → ["users"]
usersQueries.single.key({ id: "1" });       // → ["users", "1"]
queryClient.invalidateQueries({ queryKey: usersQueries.base() }); // invalidates all users queries
```

### `createQueryProxy`

Wraps any typed object so every async method gets `.$key()` and `.$query()` helpers. Keys are derived automatically from the property-access path — no manual definitions needed:

```ts
import { createQueryProxy } from "@padosoft/utilities/lib/query-proxy";

const q = createQueryProxy(apiClient);

// Auto-derived key: ['v1', 'users', 'getUser', { id: '1' }]
useQuery({ ...q.v1.users.getUser.$query({ id: "1" }) });

// Direct call still works:
await q.v1.users.getUser({ id: "1" });
```

## Configuration store

A typed, observable config store with override support and React integration via `@padosoft/react`:

```ts
import { Configuration, defineConfigOverride } from "@padosoft/utilities/lib/configuration";

interface AppConfig {
  apiUrl: string;
  debug: boolean;
}

const config = new Configuration<AppConfig>({
  apiUrl: "https://api.example.com",
  debug: false,
});

// Read
config.get();           // full config
config.get("apiUrl");   // single field, typed

// Write (triggers all subscribers)
config.set({ apiUrl: "https://staging.example.com", debug: true });

// Overrides — applied on every set()
config.addOverride(
  defineConfigOverride("apiUrl", (c) => c.debug ? "http://localhost:3000" : c.apiUrl),
);

// Subscribe (returns an unsubscribe fn)
const unsub = config.subscribe(() => console.log("config changed"));
```

## Zod utilities

```ts
import { formatZodError } from "@padosoft/utilities/lib/zod/utils";
import type { ConvertMaybeZod, DeepConvertMaybeZod } from "@padosoft/utilities/types/zod";
import { jsonCodec } from "@padosoft/utilities/lib/zod/codecs/json";
```

- **`formatZodError(error)`** — formats a `ZodError` into `{ code, message }`.
- **`ConvertMaybeZod<T>`** — if `T` is a Zod schema, infers its output type; otherwise returns `T` unchanged.
- **`DeepConvertMaybeZod<T>`** — same but recursively through objects and arrays.
- **`jsonCodec`** — Zod codec that serialises/parses JSON strings.

## Type helpers

```ts
import type {
  DeepPartial,
  FullPartial,
  Prettify,
  Intersect,
  MergeWithDefault,
  Satisfies,
  LiteralUnion,
  Mutable,
  DeepMutable,
} from "@padosoft/utilities/types/utils";
```

| Type | Description |
|------|-------------|
| `DeepPartial<T>` | Recursively makes all properties optional |
| `FullPartial<T>` | Shallow optional including `undefined` |
| `Prettify<T>` | Flattens intersections for readable IDE output |
| `Intersect<T>` | Reduces a union to its intersection |
| `MergeWithDefault<T, Key, Value>` | Adds a default key/value if missing from `T` |
| `Satisfies<U, T>` | Compile-time `satisfies` as a type alias |
| `LiteralUnion<T, U>` | Literal union that also accepts the base type without widening |
| `Mutable<T>` / `DeepMutable<T>` | Removes `readonly` modifiers |

## Misc utilities

```ts
import { fillArray, toPascalCase, isColor, sleep } from "@padosoft/utilities/lib/utils";
```

| Function | Description |
|----------|-------------|
| `fillArray(obj, n)` | Creates an array of `n` shallow copies of `obj` |
| `toPascalCase(str)` | Converts kebab/snake/space strings to PascalCase |
| `isColor(str)` | Returns `true` if `str` is a valid hex or rgb color |
| `sleep(ms)` | Returns a `Promise` that resolves after `ms` milliseconds |

## Turborepo utilities

```ts
import { listApps, listPacakges, fileNameValidator } from "@padosoft/utilities/lib/turbo";
```

Helpers for Turborepo generators: list apps/packages in the monorepo and validate user-provided file names.

## Zod defaults

```ts
import { withZodDefaults } from "@padosoft/utilities/lib/zod/defaults";
```

Merges a partial `defaults` map into a Zod object schema so that missing fields use the given default values at parse time. Works with zod v4.

```ts
const schema = z.object({
  theme: z.string(),
  debug: z.boolean(),
  retries: z.number(),
});

const withDefaults = withZodDefaults(schema, {
  theme: "light",
  retries: 3,
});

withDefaults.parse({});
// → { theme: "light", debug: <still required>, retries: 3 }
```

## Promise utilities

```ts
import { inspectSettledPromiseResults } from "@padosoft/utilities/lib/promise";
```

Splits a `Promise.allSettled` result array into `fulfilled` values and `rejected` reasons:

```ts
const results = await Promise.allSettled([fetchUser(1), fetchUser(2), fetchUser(3)]);
const { fulfilled, rejected } = inspectSettledPromiseResults(results);
// fulfilled: User[]   rejected: unknown[]
```

## Formatters

```ts
import { createCurrencyFormatter } from "@padosoft/utilities/lib/formatters";
```

Creates an `Intl.NumberFormat` instance for currency display. Locale defaults to the runtime's default locale:

```ts
const eur = createCurrencyFormatter("EUR", "it-IT");
eur.format(1234.5); // → "1.234,50 €"

const usd = createCurrencyFormatter("USD");
usd.format(1234.5); // → "$1,234.50" (using runtime locale)
```
