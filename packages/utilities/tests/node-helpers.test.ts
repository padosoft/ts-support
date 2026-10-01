import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	detectIndent,
	readJSONFile,
	writeJSONFile,
} from "../src/lib/json-file";
import { toShellCommand } from "../src/lib/process";
import { mapLimit } from "../src/lib/promise";
import { readWorkspacePackages } from "../src/lib/workspace";

describe("json-file", () => {
	test("detectIndent", () => {
		expect(detectIndent('{\n\t"a": 1\n}')).toBe("\t");
		expect(detectIndent('{\r\n  "a": 1\r\n}')).toBe("  ");
		expect(detectIndent("{}")).toBe("\t");
	});

	test("round-trips indentation", async () => {
		const path = join(mkdtempSync(join(tmpdir(), "json-file-")), "pkg.json");
		writeFileSync(path, '{\n    "a": 1\n}\n');
		const file = await readJSONFile<{ a: number }>(path);
		file.data.a = 2;
		await writeJSONFile(file);
		expect(readFileSync(path, "utf8")).toBe('{\n    "a": 2\n}\n');
	});
});

test("readWorkspacePackages lists dirs with a named, versioned package.json", () => {
	const root = mkdtempSync(join(tmpdir(), "workspace-"));
	const add = (dir: string, pkg?: object) => {
		mkdirSync(join(root, dir));
		if (pkg)
			writeFileSync(join(root, dir, "package.json"), JSON.stringify(pkg));
	};
	add("b-app", { name: "b", version: "1.0.0" });
	add("a-app", { name: "@scope/a", version: "2.0.0", buildNumber: 3 });
	add("no-version", { name: "x" });
	add("no-manifest");

	const pkgs = readWorkspacePackages(root);
	expect(pkgs.map((p) => [p.dirName, p.name, p.version])).toEqual([
		["a-app", "@scope/a", "2.0.0"],
		["b-app", "b", "1.0.0"],
	]);
	expect(pkgs[0]?.manifest.buildNumber).toBe(3);
	expect(readWorkspacePackages(join(root, "missing"))).toEqual([]);
});

test("mapLimit keeps order and caps concurrency", async () => {
	let active = 0;
	let peak = 0;
	const result = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => {
		active++;
		peak = Math.max(peak, active);
		await new Promise((r) => setTimeout(r, 5));
		active--;
		return n * 10;
	});
	expect(result).toEqual([10, 20, 30, 40, 50]);
	expect(peak).toBe(2);
});

test("toShellCommand joins safe args and rejects shell-active ones", () => {
	expect(toShellCommand("npm", ["view", "@expo/cli@next", "version"])).toBe(
		"npm view @expo/cli@next version",
	);
	expect(() => toShellCommand("npm", ["view", "expo@latest & calc"])).toThrow(
		/Refusing/,
	);
	expect(() => toShellCommand("npm", ["view", "expo@^1|x"])).toThrow(
		/Refusing/,
	);
});
