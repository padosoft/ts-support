---
"@padosoft/zod-to-openapi-client": minor
---

New package: `@padosoft/zod-to-openapi-client`.

Provides `CreateClientPaths<TCollections, TDefaultErrorResponse>` — a type utility that converts zod-to-openapi route collections into a typed `Paths` object compatible with `openapi-fetch` and `@padosoft/openapi-client`. Fully generic: no coupling to any specific API spec or error schema.
