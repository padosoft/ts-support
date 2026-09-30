import { beforeAll, describe, expect, it } from "bun:test";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { build } from "tsdown";

// The type entries are checked as published: built with this package's tsdown
// config, then compiled (`skipLibCheck: false`) by a consumer fixture that
// stubs expo-router, nativewind and React.
const packageDir = path.resolve(import.meta.dir, "../..");
const fixture = path.join(import.meta.dir, "fixtures");
const outDir = path.join(fixture, "dist");

const tsc = path.join(
	path.dirname(
		createRequire(import.meta.url).resolve("typescript/package.json"),
	),
	"bin/tsc",
);

const typecheck = (project: string) => {
	const { exitCode, stdout, stderr } = Bun.spawnSync([
		process.execPath,
		tsc,
		"--project",
		project,
	]);

	return { exitCode, output: `${stdout}${stderr}`.trim() };
};

beforeAll(async () => {
	await build({
		config: path.join(packageDir, "tsdown.config.ts"),
		entry: ["src/types/*.ts"],
		outDir,
		exports: false,
		report: false,
		logLevel: "silent",
	});
}, 60_000);

describe("@padosoft/config/types/* build output", () => {
	it("emits a declaration file per entry", () => {
		const entries = readdirSync(path.join(packageDir, "src/types"))
			.filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"))
			.map((file) => file.replace(/\.ts$/, ".d.mts"));

		expect(readdirSync(outDir)).toEqual(expect.arrayContaining(entries));
	});

	it("compiles and applies for consumers", () => {
		expect(typecheck(fixture)).toEqual({ exitCode: 0, output: "" });
	}, 30_000);
});
