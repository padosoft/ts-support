# @padosoft/zod-to-openapi-client

## 1.1.0

### Minor Changes

- [#28](https://github.com/padosoft/ts-support/pull/28) [`37e8194`](https://github.com/padosoft/ts-support/commit/37e81947646d4e536dc72c260cb1ae3b9f9db0bf) Thanks [@47PADO47](https://github.com/47PADO47)! - Add `OpenApiClientModule` abstract base class and `RoutesInput` utility type.

  `OpenApiClientModule<TRoutes, TDefaultErrorResponse>` bridges `OpenApiClient` with `CreateClientPaths` so subclasses only need to declare their route types — no manual `CreateClientPaths` wrapping needed. Accepts routes as a tuple `[typeof routeA, typeof routeB]` or object `{ key: typeof routeA }` via the new `RoutesInput<T>` helper.

  Requires `@padosoft/openapi-client` as a peer dependency (optional — only needed when using `OpenApiClientModule`).

### Patch Changes

- [`1bf25f3`](https://github.com/padosoft/ts-support/commit/1bf25f39ebc669cc0a9a061cfc28101cdb4b3eff) Thanks [@47PADO47](https://github.com/47PADO47)! - fix: parameters with exactOptionalPropertyTypes

- Updated dependencies [[`997d4a0`](https://github.com/padosoft/ts-support/commit/997d4a0c316e44dc154c358f2a1b8af2bf5350ff)]:
  - @padosoft/utilities@1.4.1

## 1.0.0

### Major Changes

- [#19](https://github.com/padosoft/ts-support/pull/19) [`19235e0`](https://github.com/padosoft/ts-support/commit/19235e0fc327d01db8985c1e021ee73cc94f36bd) Thanks [@47PADO47](https://github.com/47PADO47)! - New package: `@padosoft/zod-to-openapi-client`.

  Provides `CreateClientPaths<TCollections, TDefaultErrorResponse>` — a type utility that converts zod-to-openapi route collections into a typed `Paths` object compatible with `openapi-fetch` and `@padosoft/openapi-client`. Fully generic: no coupling to any specific API spec or error schema.

### Patch Changes

- Updated dependencies [[`d2d2d99`](https://github.com/padosoft/ts-support/commit/d2d2d9936618c54b6d3a918241efda208ae3bf46), [`eb9587d`](https://github.com/padosoft/ts-support/commit/eb9587d1ba7dbe867b37886fe240b43d105dc75b)]:
  - @padosoft/utilities@1.4.0
