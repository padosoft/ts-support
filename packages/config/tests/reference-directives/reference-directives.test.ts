import { beforeAll, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "tsdown";
import { referenceDirectives } from "../../src/compiler/plugins/reference-directives.ts";

// A small project built by tsdown with Oxc's declaration emit
// (`isolatedDeclarations`), the one that drops reference directives.
const fixture = path.join(import.meta.dir, "fixtures");
const outDir = path.join(fixture, "dist");

const read = (file: string) =>
	readFileSync(path.join(outDir, file), "utf8").replace(/\r\n/g, "\n");

beforeAll(async () => {
	await build({
		config: false,
		cwd: fixture,
		entry: [
			"src/types-only.ts",
			"src/path-only.ts",
			"src/unmarked.ts",
			"src/bundled.ts",
			"src/leading.ts",
		],
		outDir,
		dts: true,
		plugins: [referenceDirectives()],
		exports: false,
		report: false,
		logLevel: "silent",
	});
}, 60_000);

describe("referenceDirectives", () => {
	it("keeps a preserved types reference", () => {
		expect(read("types-only.d.mts")).toStartWith(
			'/// <reference types="types-entry" preserve="true" />\n',
		);
	});

	it("rebases a preserved path reference on the output file", () => {
		expect(read("path-only.d.mts")).toStartWith(
			'/// <reference path="../src/ambient/globals.d.ts" preserve="true" />\n',
		);
	});

	it("leaves out directives without preserve, as tsc does", () => {
		expect(read("unmarked.d.mts")).not.toContain("dev-only-types");
	});

	it("collects directives from every module bundled into the chunk", () => {
		expect(read("bundled.d.mts")).toStartWith(
			'/// <reference types="helper-types" preserve="true" />\n',
		);
	});

	it("reads only the directives before the first statement", () => {
		const output = read("leading.d.mts");

		expect(output).toStartWith(
			'/// <reference types="leading-types" preserve="true" />\n',
		);
		expect(output).not.toContain("after-code-types");
	});

	it("leaves the JavaScript output alone", () => {
		expect(read("types-only.mjs")).not.toContain("<reference");
	});
});
