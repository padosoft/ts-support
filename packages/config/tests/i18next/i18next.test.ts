import { describe, expect, it } from "bun:test";
import { createRequire } from "node:module";
import path from "node:path";

// Type-level tests: each fixture is a project checked with `skipLibCheck: false`,
// and `@ts-expect-error` marks the calls that must not compile.
const tsc = path.join(
	path.dirname(
		createRequire(import.meta.url).resolve("typescript/package.json"),
	),
	"bin/tsc",
);

const typecheck = (fixture: string) => {
	const { exitCode, stdout, stderr } = Bun.spawnSync([
		process.execPath,
		tsc,
		"--project",
		path.join(import.meta.dir, "fixtures", fixture),
	]);

	return { exitCode, output: `${stdout}${stderr}`.trim() };
};

describe("@padosoft/config/types/i18next", () => {
	it.each([
		["types keys, interpolation values and the locale", "augmented"],
		["passes selector, strictness and default namespace to i18next", "options"],
		["keeps i18next's permissive defaults when not augmented", "not-augmented"],
	])(
		"%s",
		(_, fixture) => {
			expect(typecheck(fixture)).toEqual({ exitCode: 0, output: "" });
		},
		30_000,
	);
});
