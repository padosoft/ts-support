---
"@padosoft/config": patch
---

Fix `@padosoft/config/types/nativewind`, `types/expo-router` and `types/css`, which the declaration build published broken.

- `types/nativewind` was an empty `export {}`: Oxc's declaration emit drops `/// <reference />` directives, and the entry is only that directive. The build now copies each entry's reference directives back on top of its `.d.mts` (rebasing `path` ones on the output).
- `types/expo-router` lost its import aliases in the bundled `.d.mts`, so every augmented interface extended itself (TS2310, hidden by `skipLibCheck`) and nothing was added. It now uses a namespace import, which bundles correctly.
- `types/css` declared nothing: the bundled `.d.mts` is a module, where `declare module "*.css"` is ignored. The declarations now live in a script, `src/types/ambient/css.d.ts`, which the entry references.
- `typescript/expo` no longer lists `@padosoft/config/types/css` in `types`: Expo apps get CSS module types from `expo/types`, and loading both is a `Duplicate identifier` error. Nothing changes for them, since the entry was empty until now.

A new test builds the type entries with the package's tsdown config and compiles a consumer fixture against the output with `skipLibCheck: false`.
