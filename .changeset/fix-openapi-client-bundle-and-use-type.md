---
"@padosoft/openapi-client": patch
---

- Add `tsdown.config.ts` to externalize `openapi-fetch` and `openapi-typescript-helpers` from the bundle and produce unbundled output with correct subpath exports
- Fix `use()` method type: accept `ClientMiddleware<any, string, any>` to avoid contravariance errors when passing a specific-K middleware (e.g. `"onError"`) — the callback parameter union would widen K to `ClientMiddlewareType`, making the assignment incompatible
