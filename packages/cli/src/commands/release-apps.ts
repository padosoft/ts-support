import { existsSync } from "node:fs";
import { chalk } from "@padosoft/utilities/lib/chalk";
import { readWorkspacePackages } from "@padosoft/utilities/lib/workspace";
import { resolveAppsDir } from "../utils/app-build-config";
import { fail } from "../utils/errors";
import { releaseWorkspacePackage } from "../utils/release";

interface ReleaseAppsOptions {
	"dry-run"?: boolean;
	"apps-dir"?: string;
}

/**
 * Tags every app under `apps/` as `<name>@<version>` and publishes the GitHub
 * Release with that version's CHANGELOG section. Meant to run after the
 * changesets "version packages" PR merges. Idempotent. Requires `git` with an
 * `origin` remote and an authenticated `gh`.
 */
export function releaseApps(opts: ReleaseAppsOptions): void {
	const dryRun = opts["dry-run"] ?? false;
	const appsDir = resolveAppsDir(opts["apps-dir"]);
	if (!existsSync(appsDir)) fail(`Apps directory not found: ${appsDir}`);

	const apps = readWorkspacePackages(appsDir);
	if (apps.length === 0) {
		console.log(
			`\n${chalk.dim(`No apps with name + version found in ${appsDir}`)}\n`,
		);
		return;
	}

	console.log(
		`\n${dryRun ? "Dry run: releasing" : "Releasing"} ${apps.length} app(s)…\n`,
	);
	for (const app of apps) releaseWorkspacePackage(app, dryRun);
	console.log("");
}
