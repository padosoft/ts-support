---
"@padosoft/cli": patch
"@padosoft/config": patch
"@padosoft/logger": patch
"@padosoft/openapi-client": patch
"@padosoft/react": patch
"@padosoft/utilities": patch
"@padosoft/zod-to-openapi-client": patch
---

Re-publish with properly resolved workspace dependencies (`workspace:^` → real semver) now that the CI pipeline uses `bun pm pack`.
