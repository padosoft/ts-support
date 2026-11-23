import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { chalk } from "@padosoft/utilities/lib/chalk";
import { remoteTagExists } from "@padosoft/utilities/lib/git";
import { readJSONFile, writeJSONFile } from "@padosoft/utilities/lib/json-file";
import { runCommand, runOrThrow } from "@padosoft/utilities/lib/process";
import type {
	PackageManifest,
	WorkspacePackage,
} from "@padosoft/utilities/lib/workspace";
import {
	changesetDir,
	git,
	listTags,
	localTagExists,
	requireReleaseApps,
	splitList,
} from "../utils/release";
import {
	BUMPS,
	type Bump,
	bumpVersion,
	formatReleaseTag,
	isBump,
	isVersion,
	maxVersion,
	nextPreviewNumber,
} from "../utils/release-version";

interface ReleaseTagOptions {
	preview?: boolean;
	apps?: string;
	"apps-dir"?: string;
	"dry-run"?: boolean;
}

interface ChangesetStatus {
	releases?: { name?: unknown; newVersion?: unknown }[];
}

/** The highest version `changeset status` would give the packages, if it releases any of them. */
function changesetNextVersion(
	packages: WorkspacePackage[],
): string | undefined {
	const dir = mkdtempSync(join(tmpdir(), "padosoft-changeset-status-"));
	try {
		const output = join(dir, "status.json");
		runOrThrow("bunx", ["changeset", "status", "--output", output]);
		const status: ChangesetStatus = JSON.parse(readFileSync(output, "utf8"));
		const names = new Set(packages.map((p) => p.name));
		return maxVersion(
			(status.releases ?? []).flatMap((r) =>
				typeof r.name === "string" &&
				names.has(r.name) &&
				isVersion(r.newVersion)
					? [r.newVersion]
					: [],
			),
		);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

function currentVersion(packages: WorkspacePackage[]): string {
	const versions = [...new Set(packages.map((p) => p.version))];
	const [only] = versions;
	if (versions.length !== 1 || only === undefined) {
		throw new Error(
			`The apps have different versions (${packages.map((p) => `${p.dirName}@${p.version}`).join(", ")}): pass patch, minor or major to release them at one version`,
		);
	}
	return only;
}

/** The base every bump starts from: the highest version among the apps. */
function baseVersion(packages: WorkspacePackage[]): string {
	const invalid = packages.find((p) => !isVersion(p.version));
	if (invalid !== undefined) {
		throw new Error(
			`${invalid.manifestPath}: version "${invalid.version}" is not X.Y.Z`,
		);
	}
	return maxVersion(packages.map((p) => p.version)) ?? "0.0.0";
}

function releaseVersion(
	packages: WorkspacePackage[],
	bump: Bump | undefined,
	preview: boolean,
	changesets: boolean,
): string {
	const base = baseVersion(packages);
	if (bump !== undefined) return bumpVersion(base, bump);
	if (preview) {
		return (
			(changesets ? changesetNextVersion(packages) : undefined) ??
			bumpVersion(base, "patch")
		);
	}
	if (changesets) return currentVersion(packages);
	throw new Error(
		`Pass ${BUMPS.join(", ")}: there is no .changeset/ folder whose version to release`,
	);
}

async function writeVersion(
	packages: WorkspacePackage[],
	version: string,
): Promise<string[]> {
	const changed: string[] = [];
	for (const pkg of packages) {
		if (pkg.version === version) continue;
		const file = await readJSONFile<PackageManifest>(pkg.manifestPath);
		await writeJSONFile({ ...file, data: { ...file.data, version } });
		changed.push(relative(process.cwd(), pkg.manifestPath));
	}
	return changed;
}

/**
 * Cuts a release by pushing its tag(s), which the release workflows pick up.
 * Production bumps the apps (fixed version), commits and tags; with
 * changesets and no bump it tags the version `changeset version` already set.
 * `--preview` tags the next version's `-preview.N` without touching
 * package.json. `--apps` tags `<app>@v…` per app instead of the plain tag.
 */
export async function releaseTag(
	bumpArg: string | undefined,
	opts: ReleaseTagOptions,
): Promise<void> {
	if (bumpArg !== undefined && !isBump(bumpArg)) {
		throw new Error(`Unknown bump "${bumpArg}": expected ${BUMPS.join(", ")}`);
	}
	const dryRun = opts["dry-run"] ?? false;
	const preview = opts.preview ?? false;
	const names = splitList(opts.apps);
	const { packages } = requireReleaseApps(opts["apps-dir"], names);
	const changesets = changesetDir() !== undefined;

	const version = releaseVersion(packages, bumpArg, preview, changesets);
	const tagApps: (string | undefined)[] =
		names.length > 0 ? packages.map((p) => p.dirName) : [undefined];
	const previewNumber = preview
		? nextPreviewNumber(listTags(), version, tagApps)
		: undefined;
	const tags = tagApps.map((app) =>
		formatReleaseTag({
			...(app === undefined ? {} : { app }),
			version,
			...(previewNumber === undefined ? {} : { preview: previewNumber }),
		}),
	);

	const taken = tags.filter((t) => localTagExists(t) || remoteTagExists(t));
	if (taken.length > 0)
		throw new Error(`Tag already exists: ${taken.join(", ")}`);

	const bumped = preview ? [] : packages.filter((p) => p.version !== version);
	const message = `chore(release): v${version}`;
	const label = dryRun ? chalk.yellow("would") : chalk.green("done");
	console.log("");

	if (dryRun) {
		for (const pkg of bumped)
			console.log(`  ${label}  ${pkg.name} ${pkg.version} → ${version}`);
		if (bumped.length > 0) console.log(`  ${label}  commit "${message}"`);
		for (const tag of tags) console.log(`  ${label}  tag and push ${tag}`);
		console.log("");
		return;
	}

	const dirty = git(["status", "--porcelain", "--untracked-files=no"]);
	if (dirty.length > 0) {
		throw new Error(
			"The working tree has uncommitted changes: commit or stash them first",
		);
	}

	const refs = tags.map((tag) => `refs/tags/${tag}`);
	if (bumped.length > 0) {
		const branch = git(["branch", "--show-current"]);
		if (branch.length === 0)
			throw new Error("HEAD is detached: check out the branch to release");
		const files = await writeVersion(bumped, version);
		if (existsSync("bun.lock")) {
			// Workspace versions are recorded in bun.lock.
			await runCommand("bun", [
				"install",
				"--lockfile-only",
				"--ignore-scripts",
			]);
			files.push("bun.lock");
		}
		git(["add", "--", ...files]);
		git(["commit", "-m", message]);
		for (const pkg of bumped)
			console.log(`  ${label}  ${pkg.name} ${pkg.version} → ${version}`);
		console.log(`  ${label}  commit "${message}"`);
		refs.unshift(`HEAD:refs/heads/${branch}`);
	}
	for (const tag of tags) git(["tag", "-a", tag, "-m", tag]);
	git(["push", "--atomic", "origin", ...refs]);
	for (const tag of tags) console.log(`  ${label}  tagged and pushed ${tag}`);
	console.log("");
}
