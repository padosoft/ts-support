# @padosoft/react

## 1.0.0

### Major Changes

- [#21](https://github.com/padosoft/ts-support/pull/21) [`318a721`](https://github.com/padosoft/ts-support/commit/318a721a402a4222a031e37446df4956f2a7692f) Thanks [@47PADO47](https://github.com/47PADO47)! - New package `@padosoft/react` with generic React utilities:

  - `useConfig(configuration, key?)` — `useSyncExternalStore`-backed hook for any `Configuration<T>` from `@padosoft/utilities`
  - `HOC` type, `composeHOCs`, `withWrap`, `withCreate`, `wrapProviders`, `getComponentName` — HOC composition utilities extracted from gescat-mobile-app

### Patch Changes

- Updated dependencies [[`d2d2d99`](https://github.com/padosoft/ts-support/commit/d2d2d9936618c54b6d3a918241efda208ae3bf46), [`eb9587d`](https://github.com/padosoft/ts-support/commit/eb9587d1ba7dbe867b37886fe240b43d105dc75b)]:
  - @padosoft/utilities@1.4.0
