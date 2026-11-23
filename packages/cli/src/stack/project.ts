import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import {
	copyFile,
	mkdir,
	readdir,
	readFile,
	writeFile,
} from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { chalk } from "@padosoft/utilities/lib/chalk";
import { detectIndent } from "@padosoft/utilities/lib/json-file";
import { runCommand, WINDOWS_SHELL } from "@padosoft/utilities/lib/process";
import { parse as parseYaml } from "yaml";
import { parsePackageSpec } from "../utils/workspace";
import type { Deps } from "./schemas";

/**
 * The changes a recipe or migration makes to a project: packages, copied
 * files, merged JSON, codemods and verify commands. Each step is idempotent so
 * a recipe can be applied again after a partial failure.
 */

/** The project folder: the one holding `.padosoft/stack.json`. */
export const projectDirOf = (manifestPath: string): string =>
	dirname(dirname(manifestPath));

const log = (action: string, detail: string, color = chalk.green): void => {
	console.log(`  ${color(action.padEnd(8))} ${detail}`);
};

// ── packages ─────────────────────────────────────────────────────────────────

export type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

const LOCKFILES: [string, PackageManager][] = [
	["bun.lock", "bun"],
	["bun.lockb", "bun"],
	["pnpm-lock.yaml", "pnpm"],
	["yarn.lock", "yarn"],
	["package-lock.json", "npm"],
];

/** Package manager of the lockfile in `dir` itself. */
export const lockfileManager = (dir: string): PackageManager | undefined =>
	LOCKFILES.find(([file]) => existsSync(join(dir, file)))?.[1];

const MANAGERS = new Set<string>(LOCKFILES.map(([, manager]) => manager));

const isManager = (name: string): name is PackageManager => MANAGERS.has(name);

/** The `packageManager` field of `<dir>/package.json` (e.g. `bun@1.2.20`). */
const declaredManager = (dir: string): PackageManager | undefined => {
	const path = join(dir, "package.json");
	if (!existsSync(path)) return undefined;
	const { packageManager }: { packageManager?: string } = JSON.parse(
		readFileSync(path, "utf8"),
	);
	const name = packageManager?.split("@")[0];
	return name !== undefined && isManager(name) ? name : undefined;
};

/**
 * Package manager of the nearest lockfile, or `packageManager` field, from
 * `dir` upwards (monorepo roots included).
 */
export function detectPackageManager(dir: string): PackageManager | undefined {
	let current = dir;
	for (;;) {
		const manager = lockfileManager(current) ?? declaredManager(current);
		if (manager !== undefined) return manager;
		const parent = dirname(current);
		if (parent === current) return undefined;
		current = parent;
	}
}

const COMMANDS: Record<
	PackageManager,
	{ add: string[]; dev: string[]; remove: string[] }
> = {
	bun: { add: ["add"], dev: ["add", "--dev"], remove: ["remove"] },
	pnpm: { add: ["add"], dev: ["add", "--save-dev"], remove: ["remove"] },
	yarn: { add: ["add"], dev: ["add", "--dev"], remove: ["remove"] },
	npm: {
		add: ["install"],
		dev: ["install", "--save-dev"],
		remove: ["uninstall"],
	},
};

/** Names of every dependency and devDependency in `<dir>/package.json`. */
export function installedPackages(dir: string): Set<string> {
	const path = join(dir, "package.json");
	if (!existsSync(path)) return new Set();
	const pkg: {
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
	} = JSON.parse(readFileSync(path, "utf8"));
	return new Set([
		...Object.keys(pkg.dependencies ?? {}),
		...Object.keys(pkg.devDependencies ?? {}),
	]);
}

export const packageName = (spec: string): string =>
	parsePackageSpec(spec).name;

export const hasDeps = (deps: Deps): boolean =>
	deps.add.length + deps.dev.length + deps.remove.length > 0;

/** `expo` run through each package manager, for `expo install`. */
const EXPO: Record<PackageManager, [string, ...string[]]> = {
	bun: ["bun", "x", "expo"],
	pnpm: ["pnpm", "expo"],
	yarn: ["yarn", "expo"],
	npm: ["npx", "expo"],
};

export interface DepCommand {
	command: string;
	args: string[];
}

/**
 * The commands that apply `deps`: removals first (only of installed
 * packages), then additions. In an Expo project runtime packages go through
 * `expo install`, which picks the versions matching the project's SDK.
 */
export function depCommands(
	manager: PackageManager,
	deps: Deps,
	installed: Set<string>,
): DepCommand[] {
	const commands = COMMANDS[manager];
	const remove = deps.remove.filter((spec) => installed.has(packageName(spec)));
	const [expo, ...expoArgs] = EXPO[manager];
	const out: DepCommand[] = [];
	if (remove.length > 0) {
		out.push({ command: manager, args: [...commands.remove, ...remove] });
	}
	if (deps.add.length > 0) {
		out.push(
			installed.has("expo")
				? { command: expo, args: [...expoArgs, "install", ...deps.add] }
				: { command: manager, args: [...commands.add, ...deps.add] },
		);
	}
	if (deps.dev.length > 0) {
		out.push({ command: manager, args: [...commands.dev, ...deps.dev] });
	}
	return out;
}

/** Removes, then adds, packages with the project's package manager. */
export async function changeDeps(dir: string, deps: Deps): Promise<void> {
	if (!hasDeps(deps)) return;
	const manager = detectPackageManager(dir);
	if (manager === undefined) {
		throw new Error(
			`No lockfile or packageManager field in ${dir} or its parents: cannot tell which package manager to use.`,
		);
	}
	for (const { command, args } of depCommands(
		manager,
		deps,
		installedPackages(dir),
	)) {
		log("run", `${command} ${args.join(" ")}`, chalk.cyan);
		// bun is a real executable; the others are .cmd shims on Windows.
		await runCommand(command, args, {
			cwd: dir,
			shell: WINDOWS_SHELL && command !== "bun",
		});
	}
}

// ── files ────────────────────────────────────────────────────────────────────

async function listFiles(dir: string): Promise<string[]> {
	const out: string[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...(await listFiles(path)));
		else if (entry.isFile()) out.push(path);
	}
	return out.sort();
}

/**
 * Copies `<from>/**` into `to`. Identical files are left alone; a different
 * existing file is kept unless `force`, and reported so nothing is lost
 * silently. Returns the paths it kept.
 */
export async function copyFiles(
	from: string,
	to: string,
	force: boolean,
): Promise<string[]> {
	if (!existsSync(from)) return [];
	const kept: string[] = [];
	for (const source of await listFiles(from)) {
		const rel = relative(from, source);
		const dest = join(to, rel);
		const content = await readFile(source);
		if (existsSync(dest)) {
			if (content.equals(await readFile(dest))) continue;
			if (!force) {
				log("keep", `${rel} (differs; --force overwrites)`, chalk.yellow);
				kept.push(rel);
				continue;
			}
		}
		await mkdir(dirname(dest), { recursive: true });
		await copyFile(source, dest);
		log("write", rel);
	}
	return kept;
}

// ── JSON merge ───────────────────────────────────────────────────────────────

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Deep merge for config files: objects merge key by key, arrays gain the items
 * they do not already contain (compared as JSON), anything else is replaced.
 * Merging the same patch twice changes nothing.
 */
export function deepMerge(target: unknown, patch: unknown): unknown {
	if (isObject(target) && isObject(patch)) {
		const out: Record<string, unknown> = { ...target };
		for (const [key, value] of Object.entries(patch)) {
			out[key] = key in target ? deepMerge(target[key], value) : value;
		}
		return out;
	}
	if (Array.isArray(target) && Array.isArray(patch)) {
		const seen = new Set(target.map((item) => JSON.stringify(item)));
		return [
			...target,
			...patch.filter((item) => !seen.has(JSON.stringify(item))),
		];
	}
	return patch;
}

/** Deep-merges each patch into its JSON file under `dir`, creating missing files. */
export async function mergeJsonFiles(
	dir: string,
	patches: Record<string, Record<string, unknown>>,
): Promise<void> {
	for (const [rel, patch] of Object.entries(patches)) {
		const path = join(dir, rel);
		const raw = existsSync(path) ? await readFile(path, "utf8") : undefined;
		const current: unknown = raw === undefined ? {} : JSON.parse(raw);
		const merged = deepMerge(current, patch);
		if (JSON.stringify(merged) === JSON.stringify(current)) continue;
		await mkdir(dirname(path), { recursive: true });
		const indent = raw === undefined ? "\t" : detectIndent(raw);
		await writeFile(path, `${JSON.stringify(merged, null, indent)}\n`, "utf8");
		log(raw === undefined ? "write" : "merge", rel);
	}
}

// ── codemods and verify ──────────────────────────────────────────────────────

const CODEMODS = ["codemod.mjs", "codemod.js", "codemod.ts"];

/**
 * The Codemod CLI (https://docs.codemod.com) that runs and tests migrations
 * packaged as Codemod packages, pinned. Its analytics stay off: through
 * `--disable-analytics` and `DISABLE_ANALYTICS=1`.
 */
export const CODEMOD_CLI = "codemod@1.18.7";

const codemodEnv = (projectDir?: string): NodeJS.ProcessEnv => ({
	...process.env,
	DISABLE_ANALYTICS: "1",
	...(projectDir === undefined ? {} : { PADOSOFT_PROJECT_DIR: projectDir }),
});

/** Whether `dir` is a Codemod package: it has a `workflow.yaml`. */
export const isCodemodPackage = (dir: string): boolean =>
	existsSync(join(dir, "workflow.yaml"));

/** The `bunx` args that run a Codemod package's workflow on `projectDir`. */
export const codemodRunArgs = (dir: string, projectDir: string): string[] => [
	CODEMOD_CLI,
	"workflow",
	"run",
	"-w",
	dir,
	"-t",
	projectDir,
	"--no-interactive",
	"--allow-dirty",
	"--disable-analytics",
];

/**
 * Runs the migration's codemod in the project folder: a Codemod package's
 * workflow (`workflow.yaml`) through the pinned Codemod CLI, else
 * `codemod.{mjs,js,ts}` with the current runtime (Node 22.18+ and Bun both run
 * TypeScript), which may import the stacks source's own dependencies. The
 * workflow runs with `--allow-dirty`: the migration's package changes come
 * first, so the tree is never clean by then.
 */
export async function runCodemod(
	dir: string,
	projectDir: string,
): Promise<boolean> {
	if (isCodemodPackage(dir)) {
		log("codemod", `${basename(dir)} (${CODEMOD_CLI})`, chalk.cyan);
		await runCommand("bunx", codemodRunArgs(dir, projectDir), {
			cwd: projectDir,
			env: codemodEnv(projectDir),
		});
		return true;
	}
	const file = CODEMODS.map((name) => join(dir, name)).find(existsSync);
	if (file === undefined) return false;
	log("codemod", relative(dirname(dir), file), chalk.cyan);
	await runCommand(process.execPath, [file], {
		cwd: projectDir,
		env: { ...process.env, PADOSOFT_PROJECT_DIR: projectDir },
	});
	return true;
}

export interface CodemodTransform {
	/** The `js_file` of a `js-ast-grep` step, relative to the package. */
	file: string;
	language: string | undefined;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const listOf = (value: unknown, key: string): unknown[] => {
	const list = isRecord(value) ? value[key] : undefined;
	return Array.isArray(list) ? list : [];
};

/** Every `js-ast-grep` transform of a Codemod package's `workflow.yaml`, once each. */
export function codemodTransforms(dir: string): CodemodTransform[] {
	const workflow: unknown = parseYaml(
		readFileSync(join(dir, "workflow.yaml"), "utf8"),
	);
	const transforms = new Map<string, CodemodTransform>();
	for (const node of listOf(workflow, "nodes")) {
		for (const step of listOf(node, "steps")) {
			const jssg = isRecord(step) ? step["js-ast-grep"] : undefined;
			if (!isRecord(jssg)) continue;
			const { js_file: file, language } = jssg;
			if (typeof file !== "string") continue;
			transforms.set(file, {
				file,
				language: typeof language === "string" ? language : undefined,
			});
		}
	}
	return [...transforms.values()];
}

/**
 * The transforms of the Codemod package in `dir` that have tests, with their
 * test folder: `tests/<transform file name>` (`scripts/eas-json.ts` →
 * `tests/eas-json`), or the whole `tests` when the package has a single
 * transform. Transforms without one are skipped.
 */
export function codemodTests(
	dir: string,
): (CodemodTransform & { tests: string })[] {
	const transforms = codemodTransforms(dir);
	return transforms.flatMap((transform) => {
		const own = join(
			"tests",
			basename(transform.file, extname(transform.file)),
		);
		if (existsSync(join(dir, own))) return [{ ...transform, tests: own }];
		if (transforms.length === 1 && existsSync(join(dir, "tests")))
			return [{ ...transform, tests: "tests" }];
		return [];
	});
}

/**
 * Runs `codemod jssg test` for each transform of the Codemod package in `dir`
 * that has tests (see {@link codemodTests}). Returns the problems.
 */
export async function testCodemod(dir: string): Promise<string[]> {
	const problems: string[] = [];
	for (const { file, language, tests } of codemodTests(dir)) {
		if (language === undefined) {
			problems.push(`${file}: its js-ast-grep step has no language`);
			continue;
		}
		log("test", `${basename(dir)}/${file} on ${tests}`, chalk.cyan);
		try {
			await runCommand(
				"bunx",
				[
					CODEMOD_CLI,
					"jssg",
					"test",
					"-l",
					language,
					file,
					tests,
					"--disable-analytics",
				],
				{ cwd: dir, env: codemodEnv() },
			);
		} catch {
			problems.push(`${file}: codemod jssg test failed`);
		}
	}
	return problems;
}

// ── package manager ──────────────────────────────────────────────────────────

const FOREIGN_LOCKFILES = [
	"package-lock.json",
	"npm-shrinkwrap.json",
	"yarn.lock",
	"pnpm-lock.yaml",
];

/**
 * Bun-only findings for a JS project: npm, yarn or pnpm lockfiles in the repo
 * root or the project folder, and a root `package.json` (the first of the two
 * that has one) whose `packageManager` is missing or not `bun@…`. Empty when
 * neither folder has a `package.json`.
 */
export function packageManagerFindings(
	projectDir: string,
	rootDir: string,
): string[] {
	const dirs = [...new Set([resolve(rootDir), resolve(projectDir)])];
	const manifestDir = dirs.find((dir) => existsSync(join(dir, "package.json")));
	if (manifestDir === undefined) return [];
	const findings: string[] = [];
	for (const dir of dirs) {
		for (const file of FOREIGN_LOCKFILES) {
			if (existsSync(join(dir, file)))
				findings.push(`${join(dir, file)}: use bun (bun.lock), not ${file}`);
		}
	}
	const manifestPath = join(manifestDir, "package.json");
	const { packageManager }: { packageManager?: unknown } = JSON.parse(
		readFileSync(manifestPath, "utf8"),
	);
	if (
		typeof packageManager !== "string" ||
		!packageManager.startsWith("bun@")
	) {
		findings.push(
			`${manifestPath}: "packageManager" must be "bun@<version>"${typeof packageManager === "string" ? `, not "${packageManager}"` : ", it is missing"}`,
		);
	}
	return findings;
}

/** Runs each command through the shell in `dir`; returns the first that failed. */
export function runVerify(commands: string[], dir: string): string | undefined {
	for (const command of commands) {
		log("verify", command, chalk.cyan);
		const result = spawnSync(command, {
			cwd: dir,
			shell: true,
			stdio: "inherit",
		});
		if (result.status !== 0) return command;
	}
	return undefined;
}

/** The content of `steps.md` in `dir`, if any. */
export const readSteps = (dir: string): string | undefined => {
	const path = join(dir, "steps.md");
	return existsSync(path) ? readFileSync(path, "utf8") : undefined;
};
