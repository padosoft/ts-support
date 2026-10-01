import type { BuildPlatform } from "@padosoft/utilities/lib/build-number";
import { chalk } from "@padosoft/utilities/lib/chalk";
import {
	loadAppBuildConfig,
	resolveAppsDir,
	writeBuildNumber,
} from "../utils/app-build-config";
import {
	type EASBuild,
	fetchEasBuilds,
	findBuildCollision,
	findUniqueBuildNumber,
} from "../utils/eas";
import { fail } from "../utils/errors";

interface BuildCheckOptions {
	"auto-increment"?: boolean;
	platform?: string;
	format?: string;
	"apps-dir"?: string;
}

export async function buildCheck(
	appName: string,
	opts: BuildCheckOptions,
): Promise<void> {
	const { platform } = opts;
	if (platform !== undefined && platform !== "ios" && platform !== "android") {
		fail('--platform must be "ios" or "android"');
	}
	const platforms: BuildPlatform[] = platform ? [platform] : ["ios", "android"];

	const config = await loadAppBuildConfig(
		appName,
		resolveAppsDir(opts["apps-dir"]),
		opts.format,
	);
	console.log(
		`\nChecking build version for ${chalk.cyan(appName)} ${chalk.dim(`(v${config.version}, buildNumber ${config.buildNumber}, format ${config.format})`)}`,
	);

	const buildsByPlatform = new Map<BuildPlatform, EASBuild[]>();
	for (const p of platforms) {
		console.log(`  ${chalk.dim("fetch")}    ${p} builds…`);
		buildsByPlatform.set(p, fetchEasBuilds(config.appDir, p));
	}

	if (!opts["auto-increment"]) {
		const collision = findBuildCollision(config, buildsByPlatform);
		if (collision) {
			const { platform: p, buildVersion, build } = collision;
			fail(
				[
					`Duplicate ${p} build: version ${config.version}, build version ${buildVersion}`,
					`  existing build ${build.id} (status: ${build.status}, channel: ${build.channel})`,
					`  fix: padosoft build bump ${appName}   or   padosoft build check ${appName} --auto-increment`,
				].join("\n"),
			);
		}
		console.log(
			`\n${chalk.green("✓")} buildNumber ${config.buildNumber} is unique\n`,
		);
		return;
	}

	const { buildNumber, skipped } = findUniqueBuildNumber(
		config,
		buildsByPlatform,
	);
	for (const { buildNumber: taken, platform: p, build } of skipped) {
		console.log(
			`  ${chalk.yellow("taken")}    buildNumber ${taken} on ${p} (build ${build.id.slice(0, 8)}…, ${build.status})`,
		);
	}

	if (skipped.length === 0) {
		console.log(`\n${chalk.green("✓")} buildNumber ${buildNumber} is unique\n`);
		return;
	}

	config.buildNumber = buildNumber;
	await writeBuildNumber(config);
	console.log(
		`\n${chalk.green("✓")} buildNumber auto-incremented to ${buildNumber} (skipped ${skipped.length} duplicate(s))\n`,
	);
}
