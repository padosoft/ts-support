---
"@padosoft/zod-to-openapi-client": minor
---

Add `OpenApiClientModule` abstract base class and `RoutesInput` utility type.

`OpenApiClientModule<TRoutes, TDefaultErrorResponse>` bridges `OpenApiClient` with `CreateClientPaths` so subclasses only need to declare their route types — no manual `CreateClientPaths` wrapping needed. Accepts routes as a tuple `[typeof routeA, typeof routeB]` or object `{ key: typeof routeA }` via the new `RoutesInput<T>` helper.

Requires `@padosoft/openapi-client` as a peer dependency (optional — only needed when using `OpenApiClientModule`).
