---
"@padosoft/logger": patch
---

Stamp `otel.scope.name` and `otel.scope.version` on every log record emitted by the OTEL transport, using the library's own package.json name and version. This lets backends identify which instrumentation library produced each log.
