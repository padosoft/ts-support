---
"@padosoft/cli": minor
---

Add `build bump`, `build check`, `build reset` and `release apps` commands (ported from the gescat mobile app scripts) for managing Expo app build numbers against EAS and tagging/releasing apps from their changesets CHANGELOG.

`expo update` now defaults to the `latest` dist-tag (was `canary`) and, when `--tag` is omitted on an interactive terminal, prompts for `latest`, `next`, `canary` or a custom tag.

Fix npm version lookups (`expo update`, `dep add`) silently resolving nothing on Windows.
