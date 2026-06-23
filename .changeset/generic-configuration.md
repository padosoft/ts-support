---
"@padosoft/utilities": minor
---

Add generic `Configuration<TConfig>` class and `defineConfigOverride` utility.

`Configuration<TConfig>` is a typed singleton store with override support, `useSyncExternalStore`-compatible `subscribe`/`getSnapshot`, and a `get()` overload. `defineConfigOverride` pairs a config key with a transform function for composable, type-safe overrides.
