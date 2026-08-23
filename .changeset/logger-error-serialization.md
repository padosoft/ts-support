---
"@padosoft/logger": minor
---

Error normalization in every serializing transport: `message`/`stack`/`name` of `Error` are not enumerable, so a raw Error passed to `logger.*` reached expo-fs/file/http/ws payloads (and OTel nested attributes) as `{}` — failures arrived anonymous in the logs that matter (real case: padosoft/gescat-mobile-app#572, ErrorBoundary crashes logged as `{}` in app.log).

New `@padosoft/logger/lib/serialize-error` module (`serializeError`, `normalizeErrors`, `normalizeLogEntryErrors`): Errors — bare, nested in plain objects/arrays (depth-capped), as `cause` chains, as `AggregateError.errors`, with custom enumerable diagnostic fields (`statusCode`, `code`, ...) — become plain, JSON-safe objects right before serialization. Applied in the expo-fs, file, http and ws transports and in the OTel `splitLogEntry` (which now also emits `exception.cause`, `exception.errors` and `exception.<customField>` attributes). The console and discord transports keep raw Errors on purpose (native rendering is better in dev).

Also fixes the test suite: `bun test` used to hang (`jest.useFakeTimers()` combined with real `Bun.sleep` awaits in `logger.test.ts` / `rate-limiter.test.ts`) and the OTel scope test still asserted the pre-f56ba41 `otel.scope.*` attribute keys.
