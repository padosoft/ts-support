---
"@padosoft/utilities": minor
"@padosoft/logger": minor
"@padosoft/cli": minor
---

Add `chalk` utility built on `node:util` `styleText`.

- `@padosoft/utilities`: new `./lib/chalk` subpath export — a chainable, proxy-based `chalk` instance backed by Node's native `styleText` (auto-respects `NO_COLOR`/`FORCE_COLOR`)
- `@padosoft/logger`: console transport colors now use `chalk` instead of raw ANSI escape codes
- `@padosoft/cli`: CLI output (skip/write/create/error) is now colorized via `chalk`
