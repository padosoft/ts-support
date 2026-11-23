import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chalk } from "@padosoft/utilities/lib/chalk";
import { extractChangelogSection } from "@padosoft/utilities/lib/changelog";
import {
	createAnnotatedTag,
	pushTag,
	remoteTagExists,
} from "@padosoft/utilities/lib/git";
import {
	createGithubRelease,
	githubReleaseExists,
} from "@padosoft/utilities/lib/github";
import { run, runOrThrow } from "@padosoft/utilities/lib/process";
import {
	type PackageManifest,
	readWorkspacePackages,
	type WorkspacePackage,
} from "@padosoft/utilities/lib/workspace";
import { resolveAppsDir } from "./app-build-config";

// ── apps ─────────────────────────────────────────────────────────────────────

export interface ReleaseApps {
	/** The apps to release; the root package for a single-app repo; empty when neither. */
	packages: WorkspacePackage[];
	/** Whether the packages are apps under the apps dir (false: the repo root). */
	monorepo: boolean;
	appsDir: string;
}

const rootPackage = (): WorkspacePackage | undefined => {
	const dir = process.cwd();
	const manifestPath = join(dir, "package.json");
	if (!existsSync(manifestPath)) return undefined;
	const manifest: PackageManifest = JSON.parse(
		readFileSync(manifestPath, "utf8"),
	);
	const { name, version } = manifest;
	if (typeof name !== "string" || typeof version !== "string") return undefined;
	return { dirName: ".", dir, manifestPath, manifest, name, version };
};

/**
 * The apps a release covers: the named folders under the apps dir, else every
 * app there, else the root `package.json` (a single-app repo).
 */
export function resolveReleaseApps(
	appsDirOption: string | undefined,
	names: string[] = [],
): ReleaseApps {
	const appsDir = resolveAppsDir(appsDirOption);
	const all = readWorkspacePackages(appsDir);
	if (names.length > 0) {
		const packages = names.map((name) => {
			const app = all.find((p) => p.dirName === name);
			if (app === undefined) {
				throw new Error(
					`No app "${name}" in ${appsDir} (apps: ${all.map((p) => p.dirName).join(", ") || "none"})`,
				);
			}
			return app;
		});
		return { packages, monorepo: true, appsDir };
	}
	if (all.length > 0) return { packages: all, monorepo: true, appsDir };
	const root = rootPackage();
	return { packages: root ? [root] : [], monorepo: false, appsDir };
}

/** Like {@link resolveReleaseApps}, but throws when there is nothing to release. */
export function requireReleaseApps(
	appsDirOption: string | undefined,
	names: string[] = [],
): ReleaseApps {
	const apps = resolveReleaseApps(appsDirOption, names);
	if (apps.packages.length === 0) {
		throw new Error(
			`No apps with name + version in ${apps.appsDir}, and no name + version in ./package.json`,
		);
	}
	return apps;
}

/** App folder names, for `apps=`: empty for a single-app repo. */
export const appNames = (apps: ReleaseApps): string[] =>
	apps.monorepo ? apps.packages.map((p) => p.dirName) : [];

/** `a,b` → `["a", "b"]`. */
export const splitList = (value: string | undefined): string[] =>
	(value ?? "")
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);

/** Absolute path of the repo's `.changeset` folder, when there is one. */
export const changesetDir = (): string | undefined => {
	const dir = resolve(".changeset");
	return existsSync(dir) ? dir : undefined;
};

// ── git ──────────────────────────────────────────────────────────────────────

export const git = (args: string[]): string => runOrThrow("git", args).trim();

const gitSucceeds = (args: string[]): boolean => run("git", args).status === 0;

export const localTagExists = (tag: string): boolean =>
	gitSucceeds(["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`]);

/** The commit a tag points to, fetching the tag from origin when it is not local. */
export function tagCommit(tag: string): string {
	const ref = `refs/tags/${tag}^{commit}`;
	if (!gitSucceeds(["rev-parse", "--verify", "--quiet", ref])) {
		run("git", [
			"fetch",
			"--no-tags",
			"origin",
			`+refs/tags/${tag}:refs/tags/${tag}`,
		]);
	}
	if (!gitSucceeds(["rev-parse", "--verify", "--quiet", ref])) {
		throw new Error(`Tag ${tag} not found locally or on origin`);
	}
	return git(["rev-parse", ref]);
}

/** `origin/<branch>`, fetched when missing (e.g. in a CI checkout of the tag alone). */
function ensureRemoteBranch(branch: string): string {
	const ref = `refs/remotes/origin/${branch}`;
	if (!gitSucceeds(["rev-parse", "--verify", "--quiet", ref])) {
		run("git", [
			"fetch",
			"--no-tags",
			"origin",
			`+refs/heads/${branch}:${ref}`,
		]);
	}
	if (!gitSucceeds(["rev-parse", "--verify", "--quiet", ref])) {
		throw new Error(`Branch ${branch} not found on origin`);
	}
	return ref;
}

/** `git merge-base --is-ancestor`: exit 0 yes, 1 no, anything else an error. */
function isAncestor(commit: string, ref: string): boolean {
	const result = run("git", ["merge-base", "--is-ancestor", commit, ref]);
	if (result.status === 0) return true;
	if (result.status === 1) return false;
	throw new Error(
		`git merge-base --is-ancestor ${commit} ${ref} failed: ${result.stderr || result.error?.message || ""}`.trim(),
	);
}

const remoteBranchesContaining = (commit: string): string[] =>
	git([
		"branch",
		"--remotes",
		"--contains",
		commit,
		"--format=%(refname:short)",
	])
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.endsWith("/HEAD"));

/** Whether `commit` is on `origin/<branch>` (fetched when missing). */
export const isOnBranch = (commit: string, branch: string): boolean =>
	isAncestor(commit, ensureRemoteBranch(branch));

/** Whether `commit` is on any branch of origin, fetching them all if no known one contains it. */
export function isOnAnyBranch(commit: string): boolean {
	if (remoteBranchesContaining(commit).length > 0) return true;
	run("git", [
		"fetch",
		"--no-tags",
		"origin",
		"+refs/heads/*:refs/remotes/origin/*",
	]);
	return remoteBranchesContaining(commit).length > 0;
}

/** Every local tag, after a best-effort `git fetch --tags`. */
export function listTags(): string[] {
	run("git", ["fetch", "--tags", "--quiet", "origin"]);
	return git(["tag", "--list"])
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

// ── GitHub releases ──────────────────────────────────────────────────────────

const changelogSection = (pkg: WorkspacePackage): string | undefined => {
	const changelogPath = join(pkg.dir, "CHANGELOG.md");
	if (!existsSync(changelogPath)) return undefined;
	return (
		extractChangelogSection(readFileSync(changelogPath, "utf8"), pkg.version) ??
		undefined
	);
};

/** Each package's CHANGELOG section for its version; under a heading per package when several. */
export function releaseNotes(
	packages: WorkspacePackage[],
	tag: string,
): string {
	const missing = (pkg: WorkspacePackage) =>
		`No CHANGELOG section found for ${pkg.version}.`;
	const [only] = packages;
	if (packages.length === 1 && only !== undefined) {
		return changelogSection(only) ?? `Release ${tag}. ${missing(only)}`;
	}
	return packages
		.map((pkg) => `### ${pkg.name}\n\n${changelogSection(pkg) ?? missing(pkg)}`)
		.join("\n\n");
}

/**
 * Tags HEAD as `tag`, pushes it and creates the GitHub Release. Idempotent:
 * an existing remote tag is not moved and an existing release is not
 * recreated. With `dryRun` only prints what it would do.
 */
export function publishRelease(
	{ tag, notes, label }: { tag: string; notes: string; label: string },
	dryRun: boolean,
): void {
	const prefix = chalk.cyan(`[${label}]`);

	if (remoteTagExists(tag)) {
		console.log(`  ${prefix} tag ${tag} already on origin, not moved`);
	} else if (dryRun) {
		console.log(`  ${prefix} would tag HEAD as ${tag} and push it`);
	} else {
		createAnnotatedTag(tag);
		pushTag(tag);
		console.log(`  ${prefix} ${chalk.green("tagged")} and pushed ${tag}`);
	}

	if (!dryRun && githubReleaseExists(tag)) {
		console.log(`  ${prefix} release ${tag} already exists`);
		return;
	}

	if (dryRun) {
		console.log(
			`  ${prefix} would create release ${tag}:\n${chalk.dim(notes)}\n`,
		);
		return;
	}

	createGithubRelease({ tag, notes });
	console.log(`  ${prefix} ${chalk.green("released")} ${tag}`);
}
