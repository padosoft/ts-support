import { incrementBuildNumber } from "@padosoft/utilities/lib/build-number";
import { chalk } from "@padosoft/utilities/lib/chalk";
import {
	loadAppBuildConfig,
	resolveAppsDir,
	writeBuildNumber,
} from "../utils/app-build-config";

interface BuildBumpOptions {
	format?: string;
	"apps-dir"?: string;
}

export async function buildBump(
	appName: string,
	opts: BuildBumpOptions,
): Promise<void> {
	const config = await loadAppBuildConfig(
		appName,
		resolveAppsDir(opts["apps-dir"]),
		opts.format,
	);
	const prev = config.buildNumber;
	config.buildNumber = incrementBuildNumber(prev, config.format);
	await writeBuildNumber(config);
	console.log(
		`\n[${appName}] buildNumber ${prev} → ${chalk.green(String(config.buildNumber))} ${chalk.dim(`(format: ${config.format})`)}\n`,
	);
}
