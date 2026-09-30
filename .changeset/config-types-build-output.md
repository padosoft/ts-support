---
"@padosoft/config": patch
---

Fix `@padosoft/config/types/nativewind` and `@padosoft/config/types/expo-router`, which the declaration build published broken.

- `types/nativewind` was an empty `export {}`: Oxc's declaration emit drops `/// <reference types="..." />` directives, and the entry is only that directive. The build now copies each entry's `types` references back on top of its `.d.mts`.
- `types/expo-router` lost its import aliases in the bundled `.d.mts`, so every augmented interface extended itself (TS2310, hidden by `skipLibCheck`) and nothing was added. It now uses a namespace import, which bundles correctly.

A new test builds the type entries with the package's tsdown config and compiles a consumer fixture against the output with `skipLibCheck: false`.
