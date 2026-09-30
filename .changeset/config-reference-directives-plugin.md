---
"@padosoft/config": minor
---

New `@padosoft/config/compiler/plugins/reference-directives` rolldown plugin, now included by the `tsdown()` factory.

With `isolatedDeclarations`, tsdown generates declarations with Oxc, which drops triple-slash reference directives. The plugin puts back the ones marked `preserve="true"` on top of each declaration file, as `tsc` does, collecting them from every module bundled into it and rebasing `path` references on the output. Unmarked directives are left out, as `tsc` leaves them out since TypeScript 5.5, so packages built with the factory only change when a source opts in.

`@padosoft/config`'s own type entries now use it: `types/nativewind` and `types/css` mark their directives `preserve="true"`, and the package's `tsdown.config.ts` no longer carries its own copy of the plugin.
