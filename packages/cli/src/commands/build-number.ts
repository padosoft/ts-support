import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chalk } from "@padosoft/utilities/lib/chalk";
import {
	computeBuildVersions,
	type EASBuild,
	findDuplicateBuild,
	incrementBuildNumber,
	loadAppBuildConfig,
	type Platform,
	writeBuildNumber,
} from "../utils/build-number";
import { readJSON } from "../utils/fs";

interface BuildOptions {
	format?: string;
	"apps-dir"?: string;
}

interface BuildCheckOptions extends BuildOptions {
	"auto-increment"?: boolean;
	platform?: string;
}

const MAX_AUTO_INCREMENT_ATTEMPTS = 20;

const appsDirOf = (opts: BuildOptions): string =>
	resolve(opts["apps-dir"] ?? "apps");

function fail(message: string): never {
	console.error(`\n${chalk.red("error")}  ${message}\n`);
	process.exit(1);
}

const run = async (task: () => Promise<void>): Promise<void> => {
	try {
		await task();
	} catch (error) {
		fail(error instanceof Error ? error.message : String(error));
	}
};

// ── bump ─────────────────────────────────────────────────────────────────────

export const buildBump = (appName: string, opts: BuildOptions): Promise<void> =>
	run(async () => {
		const config = await loadAppBuildConfig(
			appName,
			appsDirOf(opts),
			opts.format,
		);
		const prev = config.buildNumber;
		config.buildNumber = incrementBuildNumber(
			config.buildNumber,
			config.format,
		);
		await writeBuildNumber(config);
		console.log(
			`\n[${appName}] buildNumber ${prev} → ${chalk.green(String(config.buildNumber))} ${chalk.dim(`(format: ${config.format})`)}\n`,
		);
	});

// ── check ────────────────────────────────────────────────────────────────────

function fetchBuilds(appDir: string, platform: Platform): EASBuild[] {
	const result = spawnSync(
		"eas",
		[
			"build:list",
			"--json",
			"--platform",
			platform,
			"--limit",
			"50",
			"--non-interactive",
		],
		{ cwd: appDir, encoding: "utf8", shell: process.platform === "win32" },
	);
	const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

	if (result.error || result.status !== 0) {
		if (/not authenticated|not logged in/i.test(output)) {
			fail(
				"EAS authentication required. Run `eas login` or set the EXPO_TOKEN environment variable.",
			);
		}
		fail(
			`Failed to fetch EAS build list for ${platform}:\n${result.error?.message ?? output.trim()}`,
		);
	}

	// eas may print warnings before the JSON array
	const lines = (result.stdout ?? "").trim().split("\n");
	const jsonStart = lines.findIndex((l) => l.trim().startsWith("["));
	if (jsonStart === -1) return [];
	return JSON.parse(lines.slice(jsonStart).join("\n")) as EASBuild[];
}

export const buildCheck = (
	appName: string,
	opts: BuildCheckOptions,
): Promise<void> =>
	run(async () => {
		const { platform } = opts;
		if (
			platform !== undefined &&
			platform !== "ios" &&
			platform !== "android"
		) {
			fail('--platform must be "ios" or "android"');
		}
		const platforms: Platform[] = platform ? [platform] : ["ios", "android"];
		const autoIncrement = opts["auto-increment"] ?? false;

		const config = await loadAppBuildConfig(
			appName,
			appsDirOf(opts),
			opts.format,
		);
		console.log(
			`\nChecking build version for ${chalk.cyan(appName)} ${chalk.dim(`(v${config.version}, buildNumber ${config.buildNumber}, format ${config.format})`)}`,
		);

		const buildsByPlatform = new Map<Platform, EASBuild[]>();
		for (const p of platforms) {
			console.log(`  ${chalk.dim("fetch")}    ${p} builds…`);
			buildsByPlatform.set(p, fetchBuilds(config.appDir, p));
		}

		for (let attempts = 0; attempts < MAX_AUTO_INCREMENT_ATTEMPTS; attempts++) {
			const versions = computeBuildVersions(config);
			const collision = platforms
				.map((p) => ({
					p,
					build: findDuplicateBuild(
						buildsByPlatform.get(p) ?? [],
						config.version,
						versions[p],
						p,
					),
				}))
				.find((c) => c.build);

			if (!collision?.build) {
				if (attempts > 0) {
					await writeBuildNumber(config);
					console.log(
						`\n${chalk.green("✓")} buildNumber auto-incremented to ${config.buildNumber} (skipped ${attempts} duplicate(s))\n`,
					);
				} else {
					console.log(
						`\n${chalk.green("✓")} buildNumber ${config.buildNumber} is unique\n`,
					);
				}
				return;
			}

			const { p, build } = collision;
			if (!autoIncrement) {
				fail(
					[
						`Duplicate ${p} build: version ${config.version}, build version ${versions[p]}`,
						`  existing build ${build.id} (status: ${build.status}, channel: ${build.channel})`,
						`  fix: padosoft build bump ${appName}   or   padosoft build check ${appName} --auto-increment`,
					].join("\n"),
				);
			}

			console.log(
				`  ${chalk.yellow("taken")}    buildNumber ${config.buildNumber} on ${p} (build ${build.id.slice(0, 8)}…, ${build.status})`,
			);
			config.buildNumber = incrementBuildNumber(
				config.buildNumber,
				config.format,
			);
		}

		fail(
			`No unique buildNumber found after ${MAX_AUTO_INCREMENT_ATTEMPTS} attempts (last tried ${config.buildNumber})`,
		);
	});

// ── reset ────────────────────────────────────────────────────────────────────

export const buildReset = (opts: BuildOptions): Promise<void> =>
	run(async () => {
		const appsDir = appsDirOf(opts);
		if (!existsSync(appsDir)) fail(`Apps directory not found: ${appsDir}`);

		const entries = await readdir(appsDir, { withFileTypes: true });
		let touched = 0;
		console.log("");

		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const pkgPath = join(appsDir, entry.name, "package.json");
			if (!existsSync(pkgPath)) continue;
			// Only apps that opted into build numbering
			if (
				!("buildNumber" in (await readJSON<Record<string, unknown>>(pkgPath)))
			)
				continue;

			const config = await loadAppBuildConfig(entry.name, appsDir);
			const prev = config.buildNumber;
			// sequential: the semver is encoded in the versionCode, so the one-digit
			// slot restarts at 0 for each new version. yearly/date: the versionCode is
			// not semver-aware, so keep it strictly increasing instead.
			config.buildNumber =
				config.format === "sequential"
					? 0
					: incrementBuildNumber(prev, config.format);
			await writeBuildNumber(config);
			touched++;
			console.log(
				`  [${entry.name}] buildNumber ${prev} → ${chalk.green(String(config.buildNumber))} ${chalk.dim(`(format: ${config.format})`)}`,
			);
		}

		console.log(
			touched ? "" : `${chalk.dim("No apps with a buildNumber found")}\n`,
		);
	});
