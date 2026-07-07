---
"@padosoft/utilities": patch
---

- `QueryLeaf.$key` and `$query` now use a `const` type parameter so that call-site arguments are inferred at their narrowest type — string literals stay literal, object properties keep their exact values. The return types are `readonly [...TKey, ...TCallArgs]`, so hovering shows the actual values passed rather than the widened parameter types.
