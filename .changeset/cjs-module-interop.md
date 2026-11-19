---

"@padosoft/utilities": minor

---

New `resolveModuleInterop` helper in `@padosoft/utilities/lib/module-interop`. It resolves the real API of a CommonJS module imported through an ESM interop layer, checking the namespace, `ns.default` and `ns.default.default` (bounded depth, cycle-safe) and returning the first level that exposes every required key as a function (or that satisfies a type guard). If no level matches it throws an `Error` naming the missing keys and the shapes it inspected.

Motivating incident: `@padosoft/apple-targets` 2.10.1 called `plist.parse` on a default import equal to the whole `module.exports` of `@expo/plist`, failing at runtime with `a.default.parse is not a function`. Use this helper instead of hand-written unwrapping.
