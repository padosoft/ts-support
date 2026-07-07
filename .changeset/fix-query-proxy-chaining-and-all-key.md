---
"@padosoft/utilities": patch
---

- Fix `QueryProxy` infinite `.$query` chaining and add typed `all` namespace key.
- `$query` and `$key` are now hidden inside the proxy — accessing `proxy.$query` returns `undefined` instead of re-wrapping the proxy, so `apiClient.$query.$query.$query` is no longer possible (also a TS error).
- Every proxy node now exposes an `all` property returning the frozen key array for that namespace, enabling bulk invalidation: `queryClient.invalidateQueries({ queryKey: apiClient.$query.v1.loyalty.all })`.
- `all` is now a first-class key in the mapped type (not an intersection), so it appears first in IDE autocomplete.
