---
"@padosoft/cli": minor
"@padosoft/utilities": minor
---

`@padosoft/cli`: add `build bump`, `build check`, `build reset` and `release apps` commands (ported from the gescat mobile app scripts) for managing Expo app build numbers against EAS and tagging/releasing apps from their changesets CHANGELOG.

`expo update` now defaults to the `latest` dist-tag (was `canary`) and, when `--tag` is omitted on an interactive terminal, prompts for `latest`, `next`, `canary` or a custom tag.

Fix npm version lookups (`expo update`, `dep add`) silently resolving nothing on Windows.

`@padosoft/utilities`: add runtime-agnostic `lib/build-number` (`computeVersionCode`, `incrementBuildNumber`, `resetBuildNumber`, `computeBuildVersions`) and `lib/changelog` (`extractChangelogSection`), plus `mapLimit` in `lib/promise`. Add Node-only subpath modules, kept out of the barrels: `lib/process` (`run`, `runOrThrow`, `runCommand`, `spawnProcess`, `toShellCommand`), `lib/git`, `lib/github`, `lib/npm` (`getTaggedVersion`), `lib/workspace` (`readWorkspacePackages`) and `lib/json-file`.
