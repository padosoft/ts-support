# @padosoft/openapi-client

## 1.1.2

### Patch Changes

- [`15b72a9`](https://github.com/padosoft/ts-support/commit/15b72a9224de36ca3c8b8f747bce1b0ff32c5591) Thanks [@47PADO47](https://github.com/47PADO47)! - - Add `tsdown.config.ts` to externalize `openapi-fetch` and `openapi-typescript-helpers` from the bundle and produce unbundled output with correct subpath exports
  - Fix `use()` method type: accept `ClientMiddleware<any, string, any>` to avoid contravariance errors when passing a specific-K middleware (e.g. `"onError"`) — the callback parameter union would widen K to `ClientMiddlewareType`, making the assignment incompatible

## 1.1.1

### Patch Changes

- [`be356d3`](https://github.com/padosoft/ts-support/commit/be356d3a82f8a2cafcd729069ac893eb645b40d8) Thanks [@47PADO47](https://github.com/47PADO47)! - fix: make client/options writable
  refactor: create setClient function
  refactor: make executeMiddlewaresOfType return this
  refactor: make protected fields accessible via getters

## 1.1.0

### Minor Changes

- [`16d214b`](https://github.com/padosoft/ts-support/commit/16d214b1164d23364853c1706757bc64449b46e1) Thanks [@47PADO47](https://github.com/47PADO47)! - feat: add clone function
  feat: add OpenApiClient options property

### Patch Changes

- Updated dependencies [[`0b337a7`](https://github.com/padosoft/ts-support/commit/0b337a7a1ce08de08546b9120be116f779312947)]:
  - @padosoft/utilities@1.9.1

## 1.0.1

### Patch Changes

- [#36](https://github.com/padosoft/ts-support/pull/36) [`340c2e5`](https://github.com/padosoft/ts-support/commit/340c2e549fd97a36918e53d612217533e4c626d6) Thanks [@47PADO47](https://github.com/47PADO47)! - Re-publish with properly resolved workspace dependencies (`workspace:^` → real semver) now that the CI pipeline uses `bun pm pack`.

- Updated dependencies [[`340c2e5`](https://github.com/padosoft/ts-support/commit/340c2e549fd97a36918e53d612217533e4c626d6)]:
  - @padosoft/utilities@1.5.1

## 1.0.0

### Major Changes

- [#20](https://github.com/padosoft/ts-support/pull/20) [`bde2c49`](https://github.com/padosoft/ts-support/commit/bde2c49dddb3e2246e5d3a960a49e14129fe397b) Thanks [@47PADO47](https://github.com/47PADO47)! - Rename `BaseApiService` to `OpenApiClient` and `DefaultPaths` to `OpenApiPaths`.

### Patch Changes

- Updated dependencies [[`d2d2d99`](https://github.com/padosoft/ts-support/commit/d2d2d9936618c54b6d3a918241efda208ae3bf46), [`eb9587d`](https://github.com/padosoft/ts-support/commit/eb9587d1ba7dbe867b37886fe240b43d105dc75b)]:
  - @padosoft/utilities@1.4.0
