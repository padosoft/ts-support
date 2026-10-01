import { resetBuildNumber } from "@padosoft/utilities/lib/build-number";
import { chalk } from "@padosoft/utilities/lib/chalk";
import { readWorkspacePackages } from "@padosoft/utilities/lib/workspace";
import {
	loadAppBuildConfig,
	resolveAppsDir,
	writeBuildNumber,
} from "../utils/app-build-config";

interface BuildResetOptions {
	"apps-dir"?: string;
}

export async function buildReset(opts: BuildResetOptions): Promise<void> {
	const appsDir = resolveAppsDir(opts["apps-dir"]);
	// Only apps that opted into build numbering
	const apps = readWorkspacePackages(appsDir).filter(
		(app) => "buildNumber" in app.manifest,
	);

	if (apps.length === 0) {
		console.log(
			`\n${chalk.dim(`No apps with a buildNumber found in ${appsDir}`)}\n`,
		);
		return;
	}

	console.log("");
	for (const app of apps) {
		const config = await loadAppBuildConfig(app.dirName, appsDir);
		const prev = config.buildNumber;
		config.buildNumber = resetBuildNumber(prev, config.format);
		await writeBuildNumber(config);
		console.log(
			`  [${app.dirName}] buildNumber ${prev} → ${chalk.green(String(config.buildNumber))} ${chalk.dim(`(format: ${config.format})`)}`,
		);
	}
	console.log("");
}
