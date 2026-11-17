---
"@padosoft/cli": minor
---

Nuovo comando `padosoft styles-contract gen`: estrae staticamente (solo AST, via `oxc-parser`) ogni chiamata `fn(path, defaults, options?)` e genera un contratto tipizzato (`path → slot`) più i default per call site, con `--check` per la CI. Pensato per i layer di override di stile/tema (es. `useStyleOverride`), configurabile per funzione, namespace dei path, chiave delle varianti ed espressioni opache (`Platform.select`, `StyleSheet`).
