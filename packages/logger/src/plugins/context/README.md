# `@padosoft/logger` — context plugin

Attaches a **per-request (or per-scope) context object** to every log entry automatically — no changes to existing call sites. When a request arrives, you seed a scope with an ID, a route, a user-agent; from that point on every `logger.info/warn/error/…` inside that request carries those fields without you passing them manually.

---

## Table of contents

- [Quick start](#quick-start)
- [Choosing a store](#choosing-a-store)
  - [Shared store (default)](#shared-store-default)
  - [AsyncLocalStorage store](#asynclocalstorage-store)
- [Enriching context mid-request](#enriching-context-mid-request)
- [Per-call context overrides](#per-call-context-overrides)
- [Custom stores](#custom-stores)
- [API reference](#api-reference)
- [File layout](#file-layout)

---

## Quick start

```ts
import { logger } from "@padosoft/logger/shared";
import { contextPlugin } from "@padosoft/logger/plugins/context";

logger.use(contextPlugin({ initial: { service: "my-service" } }));

logger.info("server started");
// → { level: "INFO", message: "server started", ctx: { service: "my-service" } }
```

That's it for scripts, CLI tools, and React Native. For concurrent web servers, read on.

---

## Choosing a store

The plugin is backed by a **pluggable `ContextStore`**. Two implementations ship:

| Store | Import | When to use |
|-------|--------|-------------|
| Shared (default) | built-in (no extra import) | RN, edge without ALS, CLI, scripts |
| AsyncLocalStorage | `@padosoft/logger/plugins/context/als-store` | Node, Bun, Cloudflare Workers (concurrent) |

### Shared store (default)

A single mutable object. `runWithContext` saves and restores the previous context synchronously, so it works for serial request processing but **not** for concurrent async load — two simultaneous `runWithContext` calls will see each other's writes.

```ts
import { contextPlugin } from "@padosoft/logger/plugins/context";

// No store option → shared store is used automatically.
logger.use(contextPlugin({ initial: { service: "worker" } }));

logger.info("boot");                          // ctx: { service: "worker" }
logger.patchContext?.({ step: "fetch" });
logger.info("fetching");                      // ctx: { service: "worker", step: "fetch" }
logger.clearContext?.();
logger.info("cleared");                       // ctx: {}
```

You can explicitly construct the shared store if you want to reuse it or swap it for testing:

```ts
import { contextPlugin } from "@padosoft/logger/plugins/context";
import { createSharedContextStore } from "@padosoft/logger/plugins/context/shared-store";

const store = createSharedContextStore({ service: "worker" });
logger.use(contextPlugin({ store }));
```

### AsyncLocalStorage store

Backed by Node's `AsyncLocalStorage`. Each `runWithContext` call opens a new async scope; every continuation inside that scope — including code resumed after `await` — sees only that scope's context. Other concurrent requests are fully isolated.

**Requirements:** Node ≥ 16, Bun (any version), or Cloudflare Workers with the `nodejs_compat` compatibility flag.

#### Server setup

Register the store once at startup, **before** starting the OTEL transport or any other transport that reads context:

```ts
import { logger } from "@padosoft/logger/shared";
import { contextPlugin } from "@padosoft/logger/plugins/context";
import { createAsyncLocalStorageContextStore } from "@padosoft/logger/plugins/context/als-store";

logger.use(contextPlugin({
  initial: { service: "api", env: "production" },
  store: createAsyncLocalStorageContextStore({ service: "api", env: "production" }),
}));
```

#### Request middleware (Hono)

Wrap the rest of the middleware chain in a `runWithContext` call. Every log call that happens inside the chain — controllers, services, repositories, error handlers — carries the context automatically.

```ts
import { createFactory } from "hono/factory";

const factory = createFactory();

export const requestContextMiddleware = () =>
  factory.createMiddleware(async (c, next) => {
    await logger.runWithContext!({
      request_id: crypto.randomUUID(),
      http_method: c.req.method,
      http_path:   c.req.path,
    }, () => next());
  });

app.use("*", requestContextMiddleware());
```

#### Request middleware (Express / Fastify)

```ts
// Express
app.use((req, res, next) => {
  logger.runWithContext!({ request_id: req.headers["x-request-id"] ?? crypto.randomUUID() }, next);
});

// Fastify
fastify.addHook("onRequest", async (request) => {
  // runWithContext is synchronous — wrap next() manually or use a lifecycle hook
  // that supports async context propagation.
});
```

---

## Enriching context mid-request

Use `patchContext` to add fields after the initial scope is opened — e.g. the authenticated user ID resolved inside an auth middleware:

```ts
// Auth middleware — runs inside the runWithContext scope:
app.use("/v1/*", async (c, next) => {
  const userId = await resolveUser(c.req.header("Authorization"));
  logger.patchContext?.({ user_id: userId });   // merges into the current scope
  await next();
});

// Any handler further down the chain:
app.get("/v1/orders", async (c) => {
  logger.info("listing orders");
  // → ctx: { request_id: "…", user_id: 42, … }
});
```

`patchContext` is always safe to call concurrently with the ALS store: it modifies only the current scope's context, never other requests'.

---

## Per-call context overrides

If you need to attach context to a **single log call** without changing the scope, pass a `ctx` field directly. Per-call fields override store fields with the same key:

```ts
logger.setContext?.({ job: "scheduler" });

logger.warn("retry failed", { ctx: { attempt: 3, job: "mailer" } });
// → ctx: { job: "mailer", attempt: 3 }  ← "mailer" wins over "scheduler"

logger.info("idle");
// → ctx: { job: "scheduler" }           ← store context unchanged
```

---

## Custom stores

Implement `ContextStore` to plug in your own storage — useful for testing, multi-tenant apps, or environments with non-standard async primitives:

```ts
import type { ContextStore } from "@padosoft/logger/plugins/context";
import { contextPlugin } from "@padosoft/logger/plugins/context";

// Example: a no-op store that always returns a fixed context (useful in tests).
const fixedStore: ContextStore = {
  get:   () => ({ env: "test" }),
  set:   () => {},
  patch: () => {},
  clear: () => {},
  run:   (_ctx, fn) => fn(),
};

logger.use(contextPlugin({ store: fixedStore }));
```

---

## API reference

### `contextPlugin(options?)`

Registers the plugin on the logger. Must be called with `logger.use(…)` before any transport that needs context (e.g. the OTEL transport).

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initial` | `Context` | `{}` | Baseline fields present in every scope / entry. |
| `store` | `ContextStore` | shared store | Backing store; swap for ALS store on concurrent servers. |

### Logger methods added by the plugin

All methods are optional (`method?.()`) — they are absent until the plugin is registered.

| Method | Signature | Description |
|--------|-----------|-------------|
| `setContext` | `(ctx) => void` | Replace the entire active context. |
| `patchContext` | `(partial) => void` | Merge fields into the active context. |
| `clearContext` | `() => void` | Reset active context to `{}`. |
| `getContext` | `() => Context` | Read the active context (current scope with ALS). |
| `runWithContext` | `(ctx, fn) => T` | Run `fn` inside an isolated scope seeded from `ctx`. |

### `createSharedContextStore(initial?)`

`import { createSharedContextStore } from "@padosoft/logger/plugins/context/shared-store"`

Returns a `ContextStore` backed by a single mutable object. Default when `store` is not passed to `contextPlugin`.

### `createAsyncLocalStorageContextStore(initial?)`

`import { createAsyncLocalStorageContextStore } from "@padosoft/logger/plugins/context/als-store"`

Returns a `ContextStore` backed by `AsyncLocalStorage`. Use for concurrent Node/Bun servers.

### `ContextStore` interface

`import type { ContextStore } from "@padosoft/logger/plugins/context"`

Implement to create a custom store. See [Custom stores](#custom-stores).

---

## File layout

```
plugins/context/
  index.ts         — contextPlugin, ContextPluginOptions
  types.ts         — Context type, ContextStore interface, Logger augmentation
  shared-store.ts  — createSharedContextStore
  als-store.ts     — createAsyncLocalStorageContextStore
  README.md        — this file
```
