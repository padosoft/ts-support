import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { run, WINDOWS_SHELL } from "@padosoft/utilities/lib/process";
import { lockfileManager, type PackageManager } from "./project";

/**
 * Where the stacks knowledge comes from. The source is either a local folder
 * (used as is: handy while authoring) or a git URL, cloned once into a cache
 * and refreshed when older than {@link DEFAULT_MAX_AGE_HOURS}. The repository
 * stays the single source of truth: the cache is never edited, only reset to
 * the remote's default branch.
 */

export const SOURCE_ENV = "PADOSOFT_STACKS_SOURCE";
export const DEFAULT_MAX_AGE_HOURS = 6;

export interface SourceOptions {
	/** Local folder or git URL; falls back to `$PADOSOFT_STACKS_SOURCE`. */
	source?: string;
	/** Fetch now, whatever the cache age. */
	refresh?: boolean;
	/** Never touch the network; requires an existing cache. */
	offline?: boolean;
	maxAgeHours?: number;
}

export interface ResolvedSource {
	root: string;
	kind: "local" | "git";
	spec: string;
	/** When the cached clone was last fetched (git sources only). */
	fetchedAt?: Date | undefined;
}

const HOUR_MS = 3_600_000;

export const cacheRoot = (): string =>
	join(
		process.env["XDG_CACHE_HOME"] ?? join(homedir(), ".cache"),
		"padosoft",
		"stacks",
	);

/** Folder name for a git URL: the URL with every unsafe character replaced. */
export const cacheSlug = (spec: string): string =>
	spec
		.replace(/^[a-z+]+:\/\//i, "")
		.replace(/\.git$/, "")
		.replace(/[^\w.-]+/g, "-")
		.replace(/^-+|-+$/g, "");

/** Git never prompts: in a hook or CI a prompt would hang the agent instead of failing. */
const gitEnv = (): NodeJS.ProcessEnv => ({
	...process.env,
	GIT_TERMINAL_PROMPT: "0",
	GCM_INTERACTIVE: "never",
});

const git = (args: string[]): { ok: boolean; output: string } => {
	const result = run("git", args, { env: gitEnv() });
	return {
		ok: result.status === 0 && result.error === undefined,
		output: (
			result.stderr ||
			result.stdout ||
			String(result.error ?? "")
		).trim(),
	};
};

const readFetchedAt = (marker: string): Date | undefined => {
	if (!existsSync(marker)) return undefined;
	const date = new Date(readFileSync(marker, "utf8").trim());
	return Number.isNaN(date.getTime()) ? undefined : date;
};

const AUTH_HINT =
	"Check that your git credentials can read it (for GitHub: `gh auth login` then `gh auth setup-git`).";

const FROZEN_INSTALL: Record<PackageManager, string[]> = {
	bun: ["install", "--frozen-lockfile"],
	pnpm: ["install", "--frozen-lockfile"],
	yarn: ["install", "--frozen-lockfile"],
	npm: ["ci"],
};

/**
 * Installs the cached source's own dependencies (what its codemods import)
 * from its lockfile. A failure only warns: rules, skills and plans still work.
 */
function installSourceDependencies(
	dir: string,
	warn: (message: string) => void,
): void {
	if (!existsSync(join(dir, "package.json"))) return;
	const manager = lockfileManager(dir);
	if (manager === undefined) {
		warn(
			`${dir} has a package.json but no lockfile: its dependencies were not installed.`,
		);
		return;
	}
	const result = run(manager, FROZEN_INSTALL[manager], {
		cwd: dir,
		shell: WINDOWS_SHELL && manager !== "bun",
	});
	if (result.status !== 0 || result.error !== undefined) {
		warn(
			`Installing the stacks source dependencies failed: ${(result.stderr || String(result.error ?? "")).trim()}`,
		);
	}
}

/**
 * Resolves the stacks source to a local folder, cloning or refreshing the cache
 * as needed. Problems that still leave a usable cache are passed to `warn`.
 */
export function resolveSource(
	options: SourceOptions,
	warn: (message: string) => void,
): ResolvedSource {
	const spec = options.source ?? process.env[SOURCE_ENV];
	if (spec === undefined || spec.trim() === "") {
		throw new Error(
			`No stacks source: pass --source <folder|git-url> or set ${SOURCE_ENV}.`,
		);
	}

	const local = resolve(spec);
	if (existsSync(local) && statSync(local).isDirectory()) {
		return { root: local, kind: "local", spec };
	}

	const dir = join(cacheRoot(), cacheSlug(spec));
	const marker = `${dir}.fetched`;
	const markFetched = (): Date => {
		const now = new Date();
		writeFileSync(marker, now.toISOString(), "utf8");
		return now;
	};

	if (!existsSync(join(dir, ".git"))) {
		if (options.offline) {
			throw new Error(`--offline: ${spec} has never been fetched.`);
		}
		mkdirSync(cacheRoot(), { recursive: true });
		rmSync(dir, { recursive: true, force: true });
		const clone = git(["clone", "--depth", "1", "--quiet", spec, dir]);
		if (!clone.ok) {
			rmSync(dir, { recursive: true, force: true });
			throw new Error(`Cannot clone ${spec}: ${clone.output}\n${AUTH_HINT}`);
		}
		installSourceDependencies(dir, warn);
		return { root: dir, kind: "git", spec, fetchedAt: markFetched() };
	}

	const fetchedAt = readFetchedAt(marker);
	const maxAge = (options.maxAgeHours ?? DEFAULT_MAX_AGE_HOURS) * HOUR_MS;
	const stale =
		fetchedAt === undefined || Date.now() - fetchedAt.getTime() > maxAge;
	if (options.offline || !(options.refresh || stale)) {
		return { root: dir, kind: "git", spec, fetchedAt };
	}

	const fetch = git([
		"-C",
		dir,
		"fetch",
		"--depth",
		"1",
		"--quiet",
		"origin",
		"HEAD",
	]);
	const reset = fetch.ok
		? git(["-C", dir, "reset", "--hard", "--quiet", "FETCH_HEAD"])
		: fetch;
	if (!reset.ok) {
		const age =
			fetchedAt === undefined
				? "an unknown time"
				: `${Math.round((Date.now() - fetchedAt.getTime()) / HOUR_MS)}h`;
		warn(
			`Could not refresh ${spec} (${reset.output}); using the copy fetched ${age} ago. ${AUTH_HINT}`,
		);
		return { root: dir, kind: "git", spec, fetchedAt };
	}
	installSourceDependencies(dir, warn);
	return { root: dir, kind: "git", spec, fetchedAt: markFetched() };
}
