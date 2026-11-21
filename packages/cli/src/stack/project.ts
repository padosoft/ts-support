import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import {
	copyFile,
	mkdir,
	readdir,
	readFile,
	writeFile,
} from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { chalk } from "@padosoft/utilities/lib/chalk";
import { detectIndent } from "@padosoft/utilities/lib/json-file";
import { runCommand, WINDOWS_SHELL } from "@padosoft/utilities/lib/process";
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

/** The `packageManager` field of `<dir>/package.json` (e.g. `bun@1.2.20`). */
const declaredManager = (dir: string): PackageManager | undefined => {
	const path = join(dir, "package.json");
	if (!existsSync(path)) return undefined;
	const { packageManager } = JSON.parse(readFileSync(path, "utf8")) as {
		packageManager?: string;
	};
	const name = packageManager?.split("@")[0];
	return name !== undefined && MANAGERS.has(name)
		? (name as PackageManager)
		: undefined;
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
	const pkg = JSON.parse(readFileSync(path, "utf8")) as {
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
	};
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
 * Runs `codemod.{mjs,js,ts}` from `dir` with the current runtime (Node 22.18+
 * and Bun both run TypeScript), in the project folder. The codemod may import
 * the stacks source's own dependencies.
 */
export async function runCodemod(
	dir: string,
	projectDir: string,
): Promise<boolean> {
	const file = CODEMODS.map((name) => join(dir, name)).find(existsSync);
	if (file === undefined) return false;
	log("codemod", relative(dirname(dir), file), chalk.cyan);
	await runCommand(process.execPath, [file], {
		cwd: projectDir,
		env: { ...process.env, PADOSOFT_PROJECT_DIR: projectDir },
	});
	return true;
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
