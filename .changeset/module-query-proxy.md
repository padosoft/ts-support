---
"@padosoft/zod-to-openapi-client": minor
---

`$query` getter on `OpenApiClientModule` — every module subclass now exposes a memoized query proxy for React Query / TanStack Query integration with no extra setup.

```ts
const auth = new AuthV1Module(client);

auth.$query.login.$key(body)     // → ["login", body]
auth.$query.login.$query(body)   // → { queryKey, queryFn }
```

The proxy is derived from `createQueryProxy` in `@padosoft/utilities/lib/query-proxy` (peer dependency).
