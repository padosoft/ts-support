---
"@padosoft/react": minor
---

Add `componentRegistry`, `useComponentOverride`, and `withComponentOverride` from `@padosoft/react`.

- `componentRegistry` — singleton registry for swapping React components at runtime (white-labelling, theming).
- `useComponentOverride(fallback, key?)` — hook that reactively resolves an override from the registry via `useSyncExternalStore`.
- `withComponentOverride(component, key?)` — HOC that wraps a component so all usage sites automatically check the registry without any per-call boilerplate. Resolves the key from `displayName` (with `.type` fallback for `memo()`-wrapped inputs).
