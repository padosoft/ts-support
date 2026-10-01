import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chalk } from "@padosoft/utilities/lib/chalk";
import { extractChangelogSection } from "../utils/changelog";

interface ReleaseAppsOptions {
	"dry-run"?: boolean;
	"apps-dir"?: string;
}

interface AppRelease {
	name: string;
	version: string;
	tag: string;
	changelogPath: string;
}

const run = (command: string, args: string[]) =>
	spawnSync(command, args, { encoding: "utf8" });

const runOrThrow = (command: string, args: string[]): string => {
	const result = run(command, args);
	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(
			`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
		);
	}
	return result.stdout;
};

const readApps = (appsDir: string): AppRelease[] =>
	readdirSync(appsDir).flatMap((dir) => {
		const pkgPath = join(appsDir, dir, "package.json");
		if (!existsSync(pkgPath)) return [];

		const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
			name?: string;
			version?: string;
		};
		if (!pkg.name || !pkg.version) return [];

		return [
			{
				name: pkg.name,
				version: pkg.version,
				tag: `${pkg.name}@${pkg.version}`,
				changelogPath: join(appsDir, dir, "CHANGELOG.md"),
			},
		];
	});

const remoteTagExists = (tag: string): boolean =>
	runOrThrow("git", [
		"ls-remote",
		"--tags",
		"origin",
		`refs/tags/${tag}`,
	]).trim().length > 0;

const releaseExists = (tag: string): boolean =>
	run("gh", ["release", "view", tag]).status === 0;

const releaseNotes = (app: AppRelease): string => {
	const changelog = existsSync(app.changelogPath)
		? readFileSync(app.changelogPath, "utf8")
		: "";
	return (
		extractChangelogSection(changelog, app.version) ??
		`Release ${app.tag}. No CHANGELOG section found for ${app.version}.`
	);
};

const releaseApp = (
	app: AppRelease,
	dryRun: boolean,
	workDir: string,
): void => {
	const label = chalk.cyan(`[${app.name}]`);

	if (remoteTagExists(app.tag)) {
		console.log(`  ${label} tag ${app.tag} already on origin, not moved`);
	} else if (dryRun) {
		console.log(`  ${label} would tag HEAD as ${app.tag} and push it`);
	} else {
		runOrThrow("git", ["tag", "-a", app.tag, "-m", app.tag]);
		runOrThrow("git", ["push", "origin", `refs/tags/${app.tag}`]);
		console.log(`  ${label} ${chalk.green("tagged")} and pushed ${app.tag}`);
	}

	if (!dryRun && releaseExists(app.tag)) {
		console.log(`  ${label} release ${app.tag} already exists`);
		return;
	}

	const notes = releaseNotes(app);
	if (dryRun) {
		console.log(
			`  ${label} would create release ${app.tag}:\n${chalk.dim(notes)}\n`,
		);
		return;
	}

	const notesPath = join(workDir, `${app.name.replace(/[/@]/g, "_")}.md`);
	writeFileSync(notesPath, `${notes}\n`);
	runOrThrow("gh", [
		"release",
		"create",
		app.tag,
		"--title",
		app.tag,
		"--notes-file",
		notesPath,
		"--verify-tag",
	]);
	console.log(`  ${label} ${chalk.green("released")} ${app.tag}`);
};

/**
 * Tags every app under `apps/` at its current version (`<name>@<version>`) and
 * publishes the matching GitHub Release, with that version's CHANGELOG section
 * as notes. Meant to run after the changesets "version packages" PR merges.
 * Idempotent: an existing tag is never moved, an existing release never
 * recreated. Requires `git` with an `origin` remote and an authenticated `gh`.
 */
export const releaseApps = (opts: ReleaseAppsOptions): void => {
	const dryRun = opts["dry-run"] ?? false;
	const appsDir = resolve(opts["apps-dir"] ?? "apps");
	if (!existsSync(appsDir)) {
		console.error(
			`\n${chalk.red("error")}  Apps directory not found: ${appsDir}\n`,
		);
		process.exit(1);
	}

	const apps = readApps(appsDir);
	if (apps.length === 0) {
		console.log(
			`\n${chalk.dim(`No apps with name + version found in ${appsDir}`)}\n`,
		);
		return;
	}

	console.log(
		`\n${dryRun ? "Dry run: releasing" : "Releasing"} ${apps.length} app(s)…\n`,
	);
	const workDir = mkdtempSync(join(tmpdir(), "padosoft-release-notes-"));
	try {
		for (const app of apps) releaseApp(app, dryRun, workDir);
	} catch (error) {
		console.error(
			`\n${chalk.red("error")}  ${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exitCode = 1;
	} finally {
		rmSync(workDir, { recursive: true, force: true });
	}
	console.log("");
};
