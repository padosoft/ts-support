# @padosoft/zod-to-openapi-client

## 4.1.0

### Minor Changes

- [`3f6547f`](https://github.com/padosoft/ts-support/commit/3f6547faa0936f68282a8720392b1531b8900755) Thanks [@47PADO47](https://github.com/47PADO47)! - - `OpenApiClientModule` gains an optional third type parameter `TModuleKey extends readonly string[] = readonly []`. When set, `.$query.all` is typed as that key and all generated keys are prefixed with it.

  - The base key is derived automatically at runtime from `static version` and `static key` on the concrete class — no extra plumbing needed.

  ```ts
  class AuthV1Module extends OpenApiClientModule<
    [typeof authRoutes],
    MyErrorResponse,
    readonly ["v1", "auth"] // ← new
  > {
    static readonly version = "v1" as const;
    static readonly key = "auth" as const;
  }

  auth.$query.all; // → readonly ['v1', 'auth']
  auth.$query.login.$key(b); // → readonly ['v1', 'auth', 'login', b]
  ```

### Patch Changes

- Updated dependencies [[`3f6547f`](https://github.com/padosoft/ts-support/commit/3f6547faa0936f68282a8720392b1531b8900755)]:
  - @padosoft/utilities@1.7.1

## 4.0.0

### Patch Changes

- Updated dependencies [[`1150528`](https://github.com/padosoft/ts-support/commit/115052813066412d05798c718ebd957031d5127a)]:
  - @padosoft/utilities@1.7.0

## 3.0.0

### Patch Changes

- Updated dependencies [[`0c293e9`](https://github.com/padosoft/ts-support/commit/0c293e99dbc8158dd373f6bd7ea95669d4dff8cc)]:
  - @padosoft/utilities@1.6.0

## 2.0.1

### Patch Changes

- [#36](https://github.com/padosoft/ts-support/pull/36) [`340c2e5`](https://github.com/padosoft/ts-support/commit/340c2e549fd97a36918e53d612217533e4c626d6) Thanks [@47PADO47](https://github.com/47PADO47)! - Re-publish with properly resolved workspace dependencies (`workspace:^` → real semver) now that the CI pipeline uses `bun pm pack`.

- Updated dependencies [[`340c2e5`](https://github.com/padosoft/ts-support/commit/340c2e549fd97a36918e53d612217533e4c626d6)]:
  - @padosoft/openapi-client@1.0.1
  - @padosoft/utilities@1.5.1

## 2.0.0

### Minor Changes

- [#30](https://github.com/padosoft/ts-support/pull/30) [`577b10c`](https://github.com/padosoft/ts-support/commit/577b10cdaad7e77bad3ce3832cbfac090566eabc) Thanks [@47PADO47](https://github.com/47PADO47)! - `$query` getter on `OpenApiClientModule` — every module subclass now exposes a memoized query proxy for React Query / TanStack Query integration with no extra setup.

  ```ts
  const auth = new AuthV1Module(client);

  auth.$query.login.$key(body); // → ["login", body]
  auth.$query.login.$query(body); // → { queryKey, queryFn }
  ```

  The proxy is derived from `createQueryProxy` in `@padosoft/utilities/lib/query-proxy` (peer dependency).

### Patch Changes

- Updated dependencies [[`b8068c4`](https://github.com/padosoft/ts-support/commit/b8068c410a773cf4c732d9f812be6d347c81de49)]:
  - @padosoft/utilities@1.5.0

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
