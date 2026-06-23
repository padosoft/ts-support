# @padosoft/zod-to-openapi-client

## 1.0.0

### Major Changes

- [#19](https://github.com/padosoft/ts-support/pull/19) [`19235e0`](https://github.com/padosoft/ts-support/commit/19235e0fc327d01db8985c1e021ee73cc94f36bd) Thanks [@47PADO47](https://github.com/47PADO47)! - New package: `@padosoft/zod-to-openapi-client`.

  Provides `CreateClientPaths<TCollections, TDefaultErrorResponse>` — a type utility that converts zod-to-openapi route collections into a typed `Paths` object compatible with `openapi-fetch` and `@padosoft/openapi-client`. Fully generic: no coupling to any specific API spec or error schema.

### Patch Changes

- Updated dependencies [[`d2d2d99`](https://github.com/padosoft/ts-support/commit/d2d2d9936618c54b6d3a918241efda208ae3bf46), [`eb9587d`](https://github.com/padosoft/ts-support/commit/eb9587d1ba7dbe867b37886fe240b43d105dc75b)]:
  - @padosoft/utilities@1.4.0
