---
"@padosoft/cli": minor
---

Release foundation for tag-driven app releases, and bun-only, Codemod-based stacks.

- `padosoft release check-tag <tag>`: the release workflows' guard. Parses `vX.Y.Z`, `vX.Y.Z-preview.N`, `<app>@vX.Y.Z` and `<app>@vX.Y.Z-preview.N`; checks the tag commit is on `origin/<prod-branch>` (production) or `origin/<preview-branch>` / any branch (preview), and that a production tag matches the apps' `package.json` version; prints `profile=`, `version=`, `apps=` for `$GITHUB_OUTPUT`.
- `padosoft release tag [patch|minor|major] [--preview] [--apps a,b] [--dry-run]`: bumps the apps to one version, commits `chore(release): vX.Y.Z`, tags and pushes; with changesets and no bump it tags the current version; `--preview` tags the next version's `-preview.N` without touching `package.json`; `--apps` tags `<app>@v…` per app.
- `padosoft release apps` now tags `v<version>` when the repo has one app or all apps share one version (one GitHub Release with a section per app), and supports a single-app repo released from its root `package.json`. `--tag-format name` keeps the previous `<name>@<version>` tags.
- `padosoft stack doctor` fails on npm, yarn or pnpm lockfiles and on a root `package.json` whose `packageManager` is missing or not `bun@…` (JS projects only).
- `padosoft stack migrate` runs migrations that are Codemod packages (a `workflow.yaml`) with `bunx codemod@1.18.7 workflow run`, analytics off; `codemod.{mjs,js,ts}` still works. `padosoft stack validate` runs `codemod jssg test` for Codemod packages with a `tests/` folder.
