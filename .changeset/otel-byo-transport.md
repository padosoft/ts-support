---
"@padosoft/logger": major
---

Replace Node-only `openTelemetryTransport` with a single "bring your own OTel" `otelTransport`. The new transport takes a pluggable `emit` function and optional hooks (processEntry, redact, shouldEmit, enrichAttributes, isDisabled, onError, teardown) instead of statically importing `@opentelemetry/sdk-logs`. All `@opentelemetry/*` peer dependencies have been removed. A new `core.ts` module exports pure helper functions (splitLogEntry, redactAttributes, sensitiveLeafKeys, severityMethodFor) with zero external dependencies.
