# @padosoft/react

## 1.3.0

### Minor Changes

- [`b9fef85`](https://github.com/padosoft/ts-support/commit/b9fef85ec2bcc8c44dcbb7092b6c3a457157aaeb) Thanks [@47PADO47](https://github.com/47PADO47)! - Add `componentRegistry`, `useComponentOverride`, and `withComponentOverride` from `@padosoft/react`.

  - `componentRegistry` — singleton registry for swapping React components at runtime (white-labelling, theming).
  - `useComponentOverride(fallback, key?)` — hook that reactively resolves an override from the registry via `useSyncExternalStore`.
  - `withComponentOverride(component, key?)` — HOC that wraps a component so all usage sites automatically check the registry without any per-call boilerplate. Resolves the key from `displayName` (with `.type` fallback for `memo()`-wrapped inputs).

## 1.2.0

### Minor Changes

- [`1150528`](https://github.com/padosoft/ts-support/commit/115052813066412d05798c718ebd957031d5127a) Thanks [@47PADO47](https://github.com/47PADO47)! - Fix `Configuration` `this` binding lost when passed to `useSyncExternalStore`, add optional overrides parameter to constructor, add `ReactiveConfiguration` subclass with built-in `useConfig` hook method and new overrides methods.

### Patch Changes

- Updated dependencies [[`1150528`](https://github.com/padosoft/ts-support/commit/115052813066412d05798c718ebd957031d5127a)]:
  - @padosoft/utilities@1.7.0

## 1.1.0

### Minor Changes

- [#36](https://github.com/padosoft/ts-support/pull/36) [`340c2e5`](https://github.com/padosoft/ts-support/commit/340c2e549fd97a36918e53d612217533e4c626d6) Thanks [@47PADO47](https://github.com/47PADO47)! - Add `genericMemo` typed wrapper around `React.memo` with better generic inference.

- [#35](https://github.com/padosoft/ts-support/pull/35) [`84ef39a`](https://github.com/padosoft/ts-support/commit/84ef39a7c554105962e234c34acd01a0cbff9830) Thanks [@47PADO47](https://github.com/47PADO47)! - Add `genericMemo` — a typed wrapper around `React.memo()` that infers component props automatically and accepts an optional `propsAreEqual` comparator.

### Patch Changes

- [#36](https://github.com/padosoft/ts-support/pull/36) [`340c2e5`](https://github.com/padosoft/ts-support/commit/340c2e549fd97a36918e53d612217533e4c626d6) Thanks [@47PADO47](https://github.com/47PADO47)! - Re-publish with properly resolved workspace dependencies (`workspace:^` → real semver) now that the CI pipeline uses `bun pm pack`.

- Updated dependencies [[`340c2e5`](https://github.com/padosoft/ts-support/commit/340c2e549fd97a36918e53d612217533e4c626d6)]:
  - @padosoft/utilities@1.5.1

## 1.0.0

### Major Changes

- [#21](https://github.com/padosoft/ts-support/pull/21) [`318a721`](https://github.com/padosoft/ts-support/commit/318a721a402a4222a031e37446df4956f2a7692f) Thanks [@47PADO47](https://github.com/47PADO47)! - New package `@padosoft/react` with generic React utilities:

  - `useConfig(configuration, key?)` — `useSyncExternalStore`-backed hook for any `Configuration<T>` from `@padosoft/utilities`
  - `HOC` type, `composeHOCs`, `withWrap`, `withCreate`, `wrapProviders`, `getComponentName` — HOC composition utilities extracted from gescat-mobile-app

### Patch Changes

- Updated dependencies [[`d2d2d99`](https://github.com/padosoft/ts-support/commit/d2d2d9936618c54b6d3a918241efda208ae3bf46), [`eb9587d`](https://github.com/padosoft/ts-support/commit/eb9587d1ba7dbe867b37886fe240b43d105dc75b)]:
  - @padosoft/utilities@1.4.0
