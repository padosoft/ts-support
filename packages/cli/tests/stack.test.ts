import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
	agentTargets,
	contextCommand,
	instructionBlock,
	setupAgents,
	upsertBlock,
	withClaudeHook,
} from "../src/stack/agents";
import {
	type Catalog,
	loadCatalog,
	parseCondition,
	type StackEntry,
} from "../src/stack/catalog";
import { renderContext } from "../src/stack/context";
import { renderSchemas } from "../src/stack/json-schemas";
import {
	CODEMOD_CLI,
	codemodRunArgs,
	codemodTransforms,
	copyFiles,
	deepMerge,
	depCommands,
	isCodemodPackage,
	mergeJsonFiles,
	packageManagerFindings,
	runVerify,
} from "../src/stack/project";
import {
	checkChoices,
	findRecipe,
	listSkills,
	planMigrations,
	resolveChain,
	selectRules,
	validateChain,
} from "../src/stack/resolve";
import { StackManifestSchema } from "../src/stack/schemas";
import { cacheSlug, resolveSource } from "../src/stack/source";

// A made-up stacks source: this repository is public, so fixtures never carry
// real stack knowledge.
const FILES: Record<string, string> = {
	"stacks/base/stack.json": JSON.stringify({
		axes: {
			lint: { options: ["alpha-lint", "beta-lint"], default: "alpha-lint" },
		},
	}),
	"stacks/base/rules/general.md": "GENERAL RULE",
	"stacks/base/rules/lint/alpha-lint.md": "ALPHA LINT RULE",
	"stacks/base/rules/lint/beta-lint.md": "BETA LINT RULE",
	"stacks/base/skills/add-tracing/SKILL.md":
		"---\nname: add-tracing\ndescription: >-\n  Use when adding\n  tracing.\n---\n# Add tracing\n",
	"stacks/app/stack.json": JSON.stringify({
		extends: ["base"],
		axes: {
			list: { options: ["old-list", "new-list"] },
			forms: { options: ["form-a", "form-b"] },
		},
	}),
	"stacks/app/rules/app.md": "APP RULE",
	"stacks/app/rules/list/new-list.md": "NEW LIST RULE",
	"stacks/app/rules/feature/tracing.md": "TRACING RULE",
	"stacks/app/migrations/2026.01-config/migration.json": JSON.stringify({
		title: "Config",
	}),
	"stacks/app/migrations/2026.02-new-list/migration.json": JSON.stringify({
		title: "Switch list",
		when: { list: "old-list" },
		set: { list: "new-list" },
		deps: { add: ["new-list"], remove: ["old-list"] },
	}),
	"stacks/app/migrations/2026.03-after-list/migration.json": JSON.stringify({
		title: "Needs new list",
		when: { list: "new-list" },
	}),
	"stacks/app/migrations/2026.04-try-form-b/migration.json": JSON.stringify({
		title: "Try form b",
		kind: "optional",
		when: { forms: "form-a" },
		set: { forms: "form-b" },
	}),
	"stacks/app/recipes/list/new-list/recipe.json": JSON.stringify({
		title: "New list",
		deps: { add: ["new-list@1.0.0"] },
	}),
	"stacks/app/recipes/list/old-list/recipe.json": JSON.stringify({
		title: "Old list",
		deps: { add: ["old-list"] },
	}),
	"stacks/app/recipes/init/recipe.json": JSON.stringify({ title: "Init" }),
	// Broken on purpose: reported, never thrown.
	"stacks/broken/recipes/x/c/recipe.json": JSON.stringify({
		title: "Bad option",
	}),
	"stacks/broken/stack.json": JSON.stringify({
		axes: { x: { options: ["a"] } },
	}),
	"stacks/broken/rules/x/b.md": "unknown option",
	"stacks/broken/rules/bad.name.md": "dotted name",
	"stacks/broken/rules/too/many/deep.md": "bad name",
	"stacks/broken/skills/wrong-name/SKILL.md":
		"---\nname: other\ndescription: d\n---\n",
};

let root: string;
let catalog: Catalog;

const write = (base: string, files: Record<string, string>) => {
	for (const [path, content] of Object.entries(files)) {
		mkdirSync(dirname(join(base, path)), { recursive: true });
		writeFileSync(join(base, path), content);
	}
};

beforeAll(async () => {
	root = mkdtempSync(join(tmpdir(), "stacks-source-"));
	write(root, FILES);
	catalog = await loadCatalog(root);
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("rule and recipe names", () => {
	test("parse into conditions", () => {
		expect(parseCondition("general")).toEqual({ kind: "always" });
		expect(parseCondition("lint/beta-lint")).toEqual({
			kind: "choice",
			axis: "lint",
			option: "beta-lint",
		});
		expect(parseCondition("feature/otel")).toEqual({
			kind: "feature",
			feature: "otel",
		});
		expect(typeof parseCondition("a/b/c")).toBe("string");
	});
});

describe("catalog", () => {
	test("loads stacks and reports broken files without throwing", () => {
		expect([...catalog.stacks.keys()]).toEqual(["app", "base", "broken"]);
		const messages = catalog.issues.map((i) => i.message).join("\n");
		expect(messages).toContain("expected <name>, <axis>/<option>");
		expect(messages).toContain("rules nest one level only");
		expect(messages).toContain('must match its folder "wrong-name"');
	});

	test("folds multi-line skill descriptions", () => {
		expect(catalog.stacks.get("base")?.skills[0]?.description).toBe(
			"Use when adding tracing.",
		);
	});
});

describe("chain", () => {
	test("orders bases first and merges axes", () => {
		const chain = resolveChain(catalog, ["app"]);
		expect(chain.stacks.map((s) => s.id)).toEqual(["base", "app"]);
		expect([...chain.axes.keys()]).toEqual(["lint", "list", "forms"]);
	});

	test("rejects unknown stacks and cycles", () => {
		expect(() => resolveChain(catalog, ["nope"])).toThrow(
			'Unknown stack "nope"',
		);
		const stack = (id: string, base: string): StackEntry => ({
			id,
			dir: id,
			definition: { extends: [base], axes: {} },
			rules: [],
			skills: [],
			migrations: [],
		});
		const cyclic: Catalog = {
			...catalog,
			stacks: new Map([
				["a", stack("a", "b")],
				["b", stack("b", "a")],
			]),
		};
		expect(() => resolveChain(cyclic, ["a"])).toThrow("cycle");
	});

	test("validation catches rules for unknown options", () => {
		expect(validateChain(resolveChain(catalog, ["app"]))).toEqual([]);
		const problems = validateChain(resolveChain(catalog, ["broken"]));
		expect(problems.join("\n")).toContain('"b" is not an option of "x"');
		expect(problems.join("\n")).toContain('"c" is not an option of "x"');
	});
});

describe("choices", () => {
	test("never apply defaults, report unknown values", () => {
		const chain = resolveChain(catalog, ["app"]);
		const check = checkChoices(chain, { list: "new-list", forms: "nope" });
		expect(check.unset).toEqual(["lint"]);
		expect(check.problems).toEqual([
			'choices.forms: "nope" is not an option of "forms" (form-a, form-b)',
		]);
	});

	test("select rules by choice and feature", () => {
		const chain = resolveChain(catalog, ["app"]);
		const files = (choices: Record<string, string>, features: string[]) =>
			selectRules(chain, choices, features).map((r) => r.file);
		expect(files({ lint: "beta-lint", list: "old-list" }, [])).toEqual([
			"general.md",
			"lint/beta-lint.md",
			"app.md",
		]);
		expect(files({ list: "new-list" }, ["tracing"])).toEqual([
			"general.md",
			"app.md",
			"feature/tracing.md",
			"list/new-list.md",
		]);
	});
});

describe("migrations", () => {
	const chain = () => resolveChain(catalog, ["app"]);

	test("run in name order and see the choices earlier ones set", () => {
		const plan = planMigrations(
			chain(),
			{ list: "old-list", forms: "form-a" },
			[],
		);
		expect(plan.required.map((m) => m.name)).toEqual([
			"2026.01-config",
			"2026.02-new-list",
			"2026.03-after-list",
		]);
		expect(plan.optional.map((m) => m.name)).toEqual(["2026.04-try-form-b"]);
	});

	test("skip applied ones and report applied ids no stack defines", () => {
		const plan = planMigrations(chain(), { list: "new-list" }, [
			"app/2026.01-config",
			"app/2026.03-after-list",
			"app/removed",
		]);
		expect(plan.required).toEqual([]);
		expect(plan.unknownApplied).toEqual(["app/removed"]);
	});
});

describe("context", () => {
	test("renders rules, skills and pending work", () => {
		const chain = resolveChain(catalog, ["app"]);
		const manifest = StackManifestSchema.parse({
			stacks: ["app"],
			choices: { list: "old-list" },
		});
		const text = renderContext({
			chain,
			manifest,
			manifestPath: ".padosoft/stack.json",
			rules: [{ label: "base/rules/general.md", content: "GENERAL RULE\n" }],
			skills: listSkills(chain),
			plan: planMigrations(chain, manifest.choices, manifest.applied),
			unset: ["lint", "forms"],
			problems: [],
		});
		expect(text).toContain("- Stacks: base → app");
		expect(text).toContain("3 required migration(s) pending");
		expect(text).toContain("No option recorded for: lint, forms");
		expect(text).toContain("<!-- base/rules/general.md -->\nGENERAL RULE");
		expect(text).toContain("- `add-tracing`: Use when adding tracing.");
	});
});

describe("source", () => {
	test("uses a local folder as is", () => {
		expect(resolveSource({ source: root }, () => {})).toMatchObject({
			root,
			kind: "local",
		});
	});

	test("requires a source", () => {
		const saved = process.env.PADOSOFT_STACKS_SOURCE;
		delete process.env.PADOSOFT_STACKS_SOURCE;
		expect(() => resolveSource({}, () => {})).toThrow("No stacks source");
		if (saved !== undefined) process.env.PADOSOFT_STACKS_SOURCE = saved;
	});

	test("slugs git URLs into folder names", () => {
		expect(cacheSlug("https://github.com/acme/stacks.git")).toBe(
			"github.com-acme-stacks",
		);
		expect(cacheSlug("git@github.com:acme/stacks.git")).toBe(
			"git-github.com-acme-stacks",
		);
	});

	test("clones a git source into the cache and refreshes it", () => {
		const work = mkdtempSync(join(tmpdir(), "stacks-git-"));
		const savedCache = process.env.XDG_CACHE_HOME;
		process.env.XDG_CACHE_HOME = join(work, "cache");
		try {
			const repo = join(work, "repo");
			write(repo, { "stacks/base/stack.json": "{}" });
			const git = (...args: string[]) =>
				spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
			git("init", "--quiet");
			git("add", ".");
			git(
				"-c",
				"user.name=t",
				"-c",
				"user.email=t@t",
				"commit",
				"--quiet",
				"-m",
				"one",
			);
			const url = `file://${repo.replaceAll("\\", "/")}`;

			const first = resolveSource({ source: url }, () => {});
			expect(first.kind).toBe("git");
			expect(
				readFileSync(join(first.root, "stacks/base/stack.json"), "utf8"),
			).toBe("{}");

			write(repo, { "stacks/base/stack.json": '{"description":"two"}' });
			git(
				"-c",
				"user.name=t",
				"-c",
				"user.email=t@t",
				"commit",
				"--quiet",
				"-am",
				"two",
			);
			const cached = resolveSource({ source: url }, () => {});
			expect(
				readFileSync(join(cached.root, "stacks/base/stack.json"), "utf8"),
			).toBe("{}");
			const refreshed = resolveSource({ source: url, refresh: true }, () => {});
			expect(
				readFileSync(join(refreshed.root, "stacks/base/stack.json"), "utf8"),
			).toContain("two");
		} finally {
			if (savedCache === undefined) delete process.env.XDG_CACHE_HOME;
			else process.env.XDG_CACHE_HOME = savedCache;
			rmSync(work, { recursive: true, force: true });
		}
	});
});

describe("published JSON Schemas", () => {
	test("are up to date (run `bun run schemas`)", () => {
		for (const [file, content] of Object.entries(renderSchemas())) {
			const published = readFileSync(
				join(import.meta.dir, "..", "schema", file),
				"utf8",
			);
			expect(JSON.parse(published)).toEqual(JSON.parse(content));
		}
	});
});

describe("recipes", () => {
	test("are found by name; init is per stack, never by name", () => {
		const chain = resolveChain(catalog, ["app"]);
		expect(findRecipe(chain, "list/new-list")?.target).toEqual({
			kind: "choice",
			axis: "list",
			option: "new-list",
		});
		expect(findRecipe(chain, "init")).toBeUndefined();
	});
});

describe("deepMerge", () => {
	test("merges objects, unions arrays, replaces values, is idempotent", () => {
		const target = { a: 1, nested: { keep: true, list: ["x", { y: 1 }] } };
		const patch = { a: 2, nested: { list: [{ y: 1 }, "z"] }, added: "new" };
		const once = deepMerge(target, patch);
		expect(once).toEqual({
			a: 2,
			nested: { keep: true, list: ["x", { y: 1 }, "z"] },
			added: "new",
		});
		expect(deepMerge(once, patch)).toEqual(once);
	});
});

describe("project files", () => {
	test("copy new files, skip identical ones, keep differing ones unless forced", async () => {
		const work = mkdtempSync(join(tmpdir(), "stacks-files-"));
		try {
			const from = join(work, "from");
			const to = join(work, "to");
			write(from, { "a.txt": "A", "dir/b.txt": "B", "c.txt": "C" });
			write(to, { "b-unrelated.txt": "x", "c.txt": "local" });
			expect(await copyFiles(from, to, false)).toEqual(["c.txt"]);
			expect(readFileSync(join(to, "dir/b.txt"), "utf8")).toBe("B");
			expect(readFileSync(join(to, "c.txt"), "utf8")).toBe("local");
			expect(await copyFiles(from, to, true)).toEqual([]);
			expect(readFileSync(join(to, "c.txt"), "utf8")).toBe("C");
		} finally {
			rmSync(work, { recursive: true, force: true });
		}
	});

	test("merge JSON keeping the file's indentation", async () => {
		const work = mkdtempSync(join(tmpdir(), "stacks-merge-"));
		try {
			write(work, { "package.json": '{\n  "name": "app"\n}\n' });
			await mergeJsonFiles(work, {
				"package.json": { scripts: { lint: "biome check" } },
				"new/config.json": { on: true },
			});
			expect(readFileSync(join(work, "package.json"), "utf8")).toBe(
				'{\n  "name": "app",\n  "scripts": {\n    "lint": "biome check"\n  }\n}\n',
			);
			expect(
				JSON.parse(readFileSync(join(work, "new/config.json"), "utf8")),
			).toEqual({ on: true });
		} finally {
			rmSync(work, { recursive: true, force: true });
		}
	});
});

describe("verify", () => {
	test("stops at the first failing command", () => {
		const pass = 'node -e "process.exit(0)"';
		const fail = 'node -e "process.exit(3)"';
		expect(runVerify([pass, fail, "never-run"], tmpdir())).toBe(fail);
		expect(runVerify([pass], tmpdir())).toBeUndefined();
	});
});

describe("agents", () => {
	test("bake the source into the command", () => {
		expect(contextCommand()).toBe("padosoft stack context --if-present");
		expect(contextCommand("git@host:acme/stacks.git")).toBe(
			"padosoft stack context --if-present --source git@host:acme/stacks.git",
		);
	});

	test("Claude hook replaces earlier stack hooks and keeps the rest", () => {
		const settings = {
			model: "x",
			hooks: {
				SessionStart: [
					{ hooks: [{ type: "command", command: "other" }] },
					{
						hooks: [
							{
								type: "command",
								command: "padosoft stack context --if-present --source old",
							},
						],
					},
				],
				Stop: [{ hooks: [{ type: "command", command: "stop" }] }],
			},
		};
		const next = withClaudeHook(
			settings,
			"padosoft stack context --if-present",
		);
		expect(next).toEqual({
			model: "x",
			hooks: {
				SessionStart: [
					{ hooks: [{ type: "command", command: "other" }] },
					{
						hooks: [
							{
								type: "command",
								command: "padosoft stack context --if-present",
							},
						],
					},
				],
				Stop: [{ hooks: [{ type: "command", command: "stop" }] }],
			},
		});
		expect(withClaudeHook(next, "padosoft stack context --if-present")).toEqual(
			next,
		);
	});

	test("instruction block is appended once, then replaced in place", () => {
		const first = upsertBlock("# Mine\n", instructionBlock("cmd-a"));
		expect(first.startsWith("# Mine\n\n<!-- padosoft:stack -->")).toBe(true);
		const second = upsertBlock(`${first}after\n`, instructionBlock("cmd-b"));
		expect(second).toContain("cmd-b");
		expect(second).not.toContain("cmd-a");
		expect(second.endsWith("after\n")).toBe(true);
	});

	test("setup writes each agent's file and is idempotent", async () => {
		const home = mkdtempSync(join(tmpdir(), "stacks-home-"));
		try {
			const targets = agentTargets(home, {});
			const run = () =>
				setupAgents(
					["claude", "codex"],
					"padosoft stack context --if-present",
					targets,
					false,
				);
			expect((await run()).map((r) => r.status)).toEqual([
				"written",
				"written",
			]);
			expect((await run()).map((r) => r.status)).toEqual([
				"unchanged",
				"unchanged",
			]);
			expect(readFileSync(join(home, ".codex", "AGENTS.md"), "utf8")).toContain(
				"padosoft stack context",
			);
		} finally {
			rmSync(home, { recursive: true, force: true });
		}
	});
});

describe("stack defaults", () => {
	const entry = (
		id: string,
		definition: Partial<StackEntry["definition"]>,
	): StackEntry => ({
		id,
		dir: id,
		definition: { extends: [], axes: {}, defaults: {}, ...definition },
		rules: [],
		skills: [],
		recipes: [],
		migrations: [],
	});
	const catalogOf = (...entries: StackEntry[]): Catalog => ({
		root: "",
		issues: [],
		stacks: new Map(entries.map((e) => [e.id, e])),
	});
	const base = entry("base", {
		axes: {
			lint: {
				options: ["biome", "ultracite"],
				descriptions: {},
				default: "biome",
			},
		},
	});
	const mobile = entry("mobile", { extends: ["base"] });
	const web = entry("web", {
		extends: ["base"],
		defaults: { lint: "ultracite" },
	});

	test("the last stack setting a default wins", () => {
		const catalog = catalogOf(base, mobile, web);
		expect(resolveChain(catalog, ["mobile"]).axes.get("lint")?.default).toBe(
			"biome",
		);
		expect(resolveChain(catalog, ["web"]).axes.get("lint")?.default).toBe(
			"ultracite",
		);
		expect(
			resolveChain(catalog, ["mobile", "web"]).axes.get("lint")?.default,
		).toBe("ultracite");
	});

	test("invalid overrides are reported, not applied", () => {
		const bad = entry("bad", {
			extends: ["base"],
			defaults: { lint: "eslint" },
		});
		const chain = resolveChain(catalogOf(base, bad), ["bad"]);
		expect(chain.axes.get("lint")?.default).toBe("biome");
		expect(validateChain(chain).join("\n")).toContain(
			'"eslint" is not an option of "lint"',
		);
	});
});

describe("package commands", () => {
	const deps = { add: ["a@1.0.0"], dev: ["b"], remove: ["gone", "absent"] };

	test("remove only installed packages, then add", () => {
		expect(depCommands("bun", deps, new Set(["gone"]))).toEqual([
			{ command: "bun", args: ["remove", "gone"] },
			{ command: "bun", args: ["add", "a@1.0.0"] },
			{ command: "bun", args: ["add", "--dev", "b"] },
		]);
	});

	test("in an Expo project runtime packages go through expo install", () => {
		expect(depCommands("npm", deps, new Set(["expo"]))).toEqual([
			{ command: "npx", args: ["expo", "install", "a@1.0.0"] },
			{ command: "npm", args: ["install", "--save-dev", "b"] },
		]);
	});
});

describe("Codemod packages", () => {
	const dir = mkdtempSync(join(tmpdir(), "padosoft-codemod-"));
	afterAll(() => rmSync(dir, { recursive: true, force: true }));

	test("a workflow.yaml makes a Codemod package; its js-ast-grep transforms are listed once", () => {
		expect(isCodemodPackage(dir)).toBe(false);
		writeFileSync(
			join(dir, "workflow.yaml"),
			[
				'version: "1"',
				"nodes:",
				"  - id: a",
				"    steps:",
				"      - name: shell",
				"        run: echo hi",
				"      - js-ast-grep:",
				"          js_file: scripts/rename.ts",
				"          language: tsx",
				"  - id: b",
				"    steps:",
				"      - js-ast-grep:",
				"          js_file: scripts/rename.ts",
				"          language: tsx",
				"      - js-ast-grep:",
				"          js_file: scripts/other.ts",
			].join("\n"),
		);
		expect(isCodemodPackage(dir)).toBe(true);
		expect(codemodTransforms(dir)).toEqual([
			{ file: "scripts/rename.ts", language: "tsx" },
			{ file: "scripts/other.ts", language: undefined },
		]);
	});

	test("the workflow runs on the project with the pinned CLI and analytics off", () => {
		expect(CODEMOD_CLI).toMatch(/^codemod@\d+\.\d+\.\d+$/);
		expect(codemodRunArgs("/m", "/p")).toEqual([
			CODEMOD_CLI,
			"workflow",
			"run",
			"-w",
			"/m",
			"-t",
			"/p",
			"--no-interactive",
			"--allow-dirty",
			"--disable-analytics",
		]);
	});
});

describe("packageManagerFindings", () => {
	const make = (files: Record<string, string>): string => {
		const dir = mkdtempSync(join(tmpdir(), "padosoft-pm-"));
		for (const [path, content] of Object.entries(files)) {
			mkdirSync(dirname(join(dir, path)), { recursive: true });
			writeFileSync(join(dir, path), content);
		}
		return dir;
	};
	const dirs: string[] = [];
	afterAll(() => {
		for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	});
	const findings = (files: Record<string, string>, sub = ""): string[] => {
		const root = make(files);
		dirs.push(root);
		return packageManagerFindings(join(root, sub), root);
	};

	test("a bun project passes", () => {
		expect(
			findings({
				"package.json": JSON.stringify({ packageManager: "bun@1.4.4" }),
				"bun.lock": "",
			}),
		).toEqual([]);
	});

	test("no package.json: not a JS project, nothing to check", () => {
		expect(findings({ "composer.json": "{}", "yarn.lock": "" })).toEqual([]);
	});

	test("foreign lockfiles and a missing or foreign packageManager fail", () => {
		const missing = findings({
			"package.json": "{}",
			"package-lock.json": "",
			"npm-shrinkwrap.json": "",
		});
		expect(missing.join("\n")).toContain("not package-lock.json");
		expect(missing.join("\n")).toContain("not npm-shrinkwrap.json");
		expect(missing.join("\n")).toContain("it is missing");
		expect(
			findings({
				"package.json": JSON.stringify({ packageManager: "pnpm@9.0.0" }),
				"pnpm-lock.yaml": "",
			}).join("\n"),
		).toContain('not "pnpm@9.0.0"');
	});

	test("in a monorepo package, the root package.json and both folders' lockfiles count", () => {
		const result = findings(
			{
				"package.json": JSON.stringify({ packageManager: "bun@1.4.4" }),
				"apps/web/package.json": "{}",
				"apps/web/yarn.lock": "",
			},
			"apps/web",
		);
		expect(result).toHaveLength(1);
		expect(result[0]).toContain("not yarn.lock");
	});
});
