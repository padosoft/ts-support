---
"@padosoft/utilities": minor
"@padosoft/logger": patch
---

Add `runtime` module to utilities with cross-runtime detection helpers (`isBrowser`, `isNode`, `supportsTTY`, `supportsColors`, `supportsUnicode`, `supportsAnsi`, etc.).

Replace `node:util` dependency in `chalk` with a self-contained ANSI implementation — the package now bundles cleanly in React Native (Metro) and browser bundlers.

Update `consoleTransport` to use CSS-based coloring (`%c` format) in browser environments, falling back to ANSI escape codes in Node and React Native.
