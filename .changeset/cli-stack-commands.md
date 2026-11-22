---
"@padosoft/cli": minor
---

Add `padosoft stack` and `padosoft agents setup`: keep projects on a shared stack read from a separate stacks source (local folder or cached git clone), with only the project's state in `.padosoft/stack.json`.

- `stack status | context | skill | plan` read the project's stacks, rules, skills and pending migrations; `stack context --if-present` is meant for agent session hooks.
- `stack init | apply` create a project and apply recipes (packages, files, JSON merges), recording the choices and features they stand for.
- `stack migrate | verify | mark` run migrations: package changes and a codemod, the agent's manual steps, verify commands, then the manifest update.
- `stack doctor` fails on drift (for CI); `stack validate` checks a whole stacks source.
- `agents setup` wires the context into Claude Code (SessionStart hook), Codex and Gemini CLI (global instructions).
- Axes can describe when to pick each option (shown by `stack init`), and stacks can override inherited defaults (last stack wins). In Expo projects, runtime packages are added with `expo install`.
- JSON Schemas for the manifest, `stack.json`, `recipe.json` and `migration.json` ship in `schema/`.
