# @padosoft/logger

Modular, transport-agnostic logger with a plugin system, batching, and adapters for Hono, Drizzle, Expo, and OpenTelemetry.

## Installation

```bash
npm install @padosoft/logger
```

## Basic usage

```ts
import { Logger } from "@padosoft/logger";
import { consoleTransport } from "@padosoft/logger/transports/console";

const logger = new Logger({
  level: "info",
  transports: [consoleTransport()],
});

logger.info("Server started", { port: 3000 });
logger.warn("High memory usage", { used: "90%" });
logger.error("Request failed", new Error("timeout"));
```

### Log levels

`trace` → `debug` → `info` → `success` → `warn` → `error` → `fatal`

## Transports

Transports receive log entries and send them somewhere. All are optional peer dependencies.

| Export | Destination | Peer dep |
|--------|------------|----------|
| `@padosoft/logger/transports/console` | stdout / stderr | — |
| `@padosoft/logger/transports/file` | Local file | — |
| `@padosoft/logger/transports/http` | HTTP endpoint | — |
| `@padosoft/logger/transports/ws` | WebSocket | — |
| `@padosoft/logger/transports/discord` | Discord webhook | — |
| `@padosoft/logger/transports/expo-fs` | Expo file system | `expo-file-system`, `expo-application` |
| `@padosoft/logger/transports/otel` | OpenTelemetry Logs | `@opentelemetry/*` |

```ts
import { httpTransport } from "@padosoft/logger/transports/http";

const logger = new Logger({
  transports: [httpTransport({ url: "https://logs.example.com/ingest" })],
});
```

## Plugins

Plugins enrich log entries or add cross-cutting behaviour before entries reach transports.

| Export | Purpose |
|--------|---------|
| `@padosoft/logger/plugins/context` | Attach static or dynamic context fields to every entry |
| `@padosoft/logger/plugins/metrics` | Count entries per level |
| `@padosoft/logger/plugins/rate-limiter` | Drop entries that exceed a rate limit |

```ts
import { contextPlugin } from "@padosoft/logger/plugins/context";

const logger = new Logger({
  transports: [consoleTransport()],
  plugins: [contextPlugin({ service: "api", env: process.env.NODE_ENV })],
});
```

## Adapters

Drop-in middleware for popular frameworks.

### Hono

```ts
import { honoLoggerAdapter } from "@padosoft/logger/adapters/hono";

app.use(honoLoggerAdapter(logger));
```

### Drizzle

```ts
import { drizzleLoggerAdapter } from "@padosoft/logger/adapters/drizzle";

const db = drizzle(client, { logger: drizzleLoggerAdapter(logger) });
```

## Batching

Flush entries in bulk to reduce I/O:

```ts
const logger = new Logger({
  transports: [httpTransport({ url: "..." })],
  batching: {
    maxBatchSize: 50,
    maxIntervalMs: 5000,
    flushOnDispose: true,
  },
});

// Explicit flush
await logger.flush();

// Or use the Disposable pattern (TypeScript 5.2+)
await using logger = new Logger({ ... });
```

## Adding transports and plugins at runtime

```ts
logger.use(consoleTransport());          // transport
logger.use(contextPlugin({ req: id }));  // plugin
logger.setLevel("debug");
```

## Cloning

Create a child logger that inherits transports and plugins:

```ts
const childLogger = logger.clone({ level: "debug" });
```
