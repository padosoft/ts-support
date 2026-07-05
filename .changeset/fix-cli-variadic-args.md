---
"@padosoft/cli": patch
---

Fix sade variadic arg collection for all `[packages...]` / `[paths...]` commands.

Sade only shifts one positional into the action for variadic optional args — the rest land in `opts._`. Without the fix, `dep add` with no args crashed with a TypeError, passing `pkg@latest` iterated over individual characters (producing `@@latest` errors), and multiple packages were silently dropped. The same bug affected `sync editor`, `init biome`, `init tsconfig`, `init tsdown`, and `i18n extract`.
