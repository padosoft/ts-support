---
"@padosoft/utilities": patch
---

- `QueryLeaf.$key` now returns a precisely typed tuple `readonly [...TKey, ...TArgs]` instead of `readonly unknown[]`, so hovering over `proxy.v1.auth.login.$key(body)` shows the exact key shape.
- `QueryLeaf.$query` now returns `QueryDescriptor<TResult, readonly [...TKey, ...TArgs]>`, giving the same precision to `queryKey` when spreading into `useQuery()`.
