/**
 * Writes the JSON Schemas of the stack formats into `schema/`, published with
 * the package so editors can validate `.padosoft/stack.json`, `stack.json`,
 * `recipe.json` and `migration.json` through `$schema`. `tests/stack.test.ts` fails when
 * they are out of date.
 *
 *   bun run schemas
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderSchemas } from "../src/stack/json-schemas";

const dir = join(import.meta.dir, "..", "schema");
for (const [file, content] of Object.entries(renderSchemas())) {
	writeFileSync(join(dir, file), content, "utf8");
	console.log(`write  schema/${file}`);
}
// Formatted like every other file of the repository.
spawnSync("bunx", ["biome", "format", "--write", dir], {
	stdio: "inherit",
	shell: process.platform === "win32",
});
