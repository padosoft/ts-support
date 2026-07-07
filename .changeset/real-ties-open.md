---
"@padosoft/zod-to-openapi-client": minor
---

- `OpenApiClientModule` gains an optional third type parameter `TModuleKey extends readonly string[] = readonly []`. When set, `.$query.all` is typed as that key and all generated keys are prefixed with it.
- The base key is derived automatically at runtime from `static version` and `static key` on the concrete class — no extra plumbing needed.

```ts
class AuthV1Module extends OpenApiClientModule<
  [typeof authRoutes],
  MyErrorResponse,
  readonly ['v1', 'auth']   // ← new
> {
  static readonly version = 'v1' as const;
  static readonly key     = 'auth' as const;
}

auth.$query.all           // → readonly ['v1', 'auth']
auth.$query.login.$key(b) // → readonly ['v1', 'auth', 'login', b]
```
