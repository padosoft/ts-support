---
"@padosoft/config": minor
---

Convert the hono/openapi → zod import-replacement plugin to unplugin, adding per-bundler entrypoints (vite, rollup, rolldown, webpack, rspack, esbuild, farm) under `compiler/plugins/hono-zod/*`. The `compiler/plugins/hono-zod` default export remains a rolldown plugin for backward compatibility.
