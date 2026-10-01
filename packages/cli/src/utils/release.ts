import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
import type { WorkspacePackage } from "@padosoft/utilities/lib/workspace";

/** `<name>@<version>`, the tag format changesets uses for packages. */
export const releaseTag = (
	pkg: Pick<WorkspacePackage, "name" | "version">,
): string => `${pkg.name}@${pkg.version}`;

/** The package's CHANGELOG section for its current version, or a placeholder. */
export function releaseNotes(pkg: WorkspacePackage): string {
	const changelogPath = join(pkg.dir, "CHANGELOG.md");
	const changelog = existsSync(changelogPath)
		? readFileSync(changelogPath, "utf8")
		: "";
	return (
		extractChangelogSection(changelog, pkg.version) ??
		`Release ${releaseTag(pkg)}. No CHANGELOG section found for ${pkg.version}.`
	);
}

/**
 * Tags HEAD as `<name>@<version>`, pushes the tag and creates the GitHub
 * Release. Idempotent: an existing remote tag is not moved and an existing
 * release is not recreated. With `dryRun` only prints what it would do.
 */
export function releaseWorkspacePackage(
	pkg: WorkspacePackage,
	dryRun: boolean,
): void {
	const tag = releaseTag(pkg);
	const label = chalk.cyan(`[${pkg.name}]`);

	if (remoteTagExists(tag)) {
		console.log(`  ${label} tag ${tag} already on origin, not moved`);
	} else if (dryRun) {
		console.log(`  ${label} would tag HEAD as ${tag} and push it`);
	} else {
		createAnnotatedTag(tag);
		pushTag(tag);
		console.log(`  ${label} ${chalk.green("tagged")} and pushed ${tag}`);
	}

	if (!dryRun && githubReleaseExists(tag)) {
		console.log(`  ${label} release ${tag} already exists`);
		return;
	}

	const notes = releaseNotes(pkg);
	if (dryRun) {
		console.log(
			`  ${label} would create release ${tag}:\n${chalk.dim(notes)}\n`,
		);
		return;
	}

	createGithubRelease({ tag, notes });
	console.log(`  ${label} ${chalk.green("released")} ${tag}`);
}
