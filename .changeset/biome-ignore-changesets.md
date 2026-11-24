---
"@padosoft/config": patch
---

Exclude `.changeset/*.md` from the shared Biome preset (`@padosoft/config/tools/biome`). Biome 2.6 formats Markdown and rewrote changeset frontmatter (`"@pkg": minor` followed by `---`) into a setext heading (`## "@pkg": minor`), which broke `changeset version` with "could not parse changeset - missing or invalid frontmatter".
