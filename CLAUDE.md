# Istruzioni per Claude — ts-support

## Regole generali

### Changeset obbligatorio per nuove feature

**IMPORTANTE**: Ogni volta che si aggiunge una nuova feature, un nuovo package, o una modifica breaking a un package esistente, **aggiungere sempre un changeset** prima di fare commit.

```bash
# Crea il file changeset manualmente in .changeset/<nome-descrittivo>.md
# Formato:
---
"@padosoft/<nome-package>": minor   # minor per nuove feature
"@padosoft/<altro-package>": patch  # patch per bug fix
---

Descrizione delle modifiche.
```

Livelli di bump:
- `major` — breaking change
- `minor` — nuova feature (backward compatible)
- `patch` — bug fix

### Branches separati

Usare sempre branch separati — mai committare direttamente su `main`.

### No `as any`

Non usare `as any`. Le uniche eccezioni approvate sono cast strutturali espliciti con tipo target concreto (es. `as unknown as GroupByVersionAndKey<T>`).

---

## Struttura packages

| Package | Descrizione |
|---------|-------------|
| `packages/utilities` | Utility generiche, zero dipendenze (tranne zod) |
| `packages/react` | React hooks e HOC utilities, peer dep `react >= 18` |
| `packages/openapi-client` | `OpenApiClient<Paths>` wrapper per openapi-fetch |
| `packages/zod-to-openapi-client` | Conversione zod-to-openapi route collections in Paths types |
| `packages/logger` | Logger con adattatori (Expo, OTel, ecc.) |
| `packages/config` | Configurazioni condivise (tsdown, typescript, biome) |

---

## Workflow publish

```bash
bun run build          # Compila tutti i packages
bun changeset          # Crea changeset interattivo (alternativa a file manuale)
bun run publish-packages  # Pubblica su npm
```
