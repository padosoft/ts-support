import {
	type BuildCodeFormat,
	type BuildPlatform,
	computeBuildVersions,
	incrementBuildNumber,
} from "@padosoft/utilities/lib/build-number";
import { run, WINDOWS_SHELL } from "@padosoft/utilities/lib/process";

export interface EASBuild {
	id: string;
	status: string;
	platform: string;
	appVersion: string;
	appBuildVersion: string;
	channel: string;
}

export interface BuildVersionState {
	version: string;
	buildNumber: number;
	format: BuildCodeFormat;
}

export interface BuildCollision {
	platform: BuildPlatform;
	buildNumber: number;
	buildVersion: string;
	build: EASBuild;
}

/** Build statuses that "consume" a build version. */
const USED_STATUSES = new Set(["FINISHED", "NEW", "IN_QUEUE", "IN_PROGRESS"]);

export const MAX_AUTO_INCREMENT_ATTEMPTS = 20;

/** The latest `limit` EAS builds of the project in `appDir` for one platform. */
export function fetchEasBuilds(
	appDir: string,
	platform: BuildPlatform,
	limit = 50,
): EASBuild[] {
	const result = run(
		"eas",
		[
			"build:list",
			"--json",
			"--platform",
			platform,
			"--limit",
			String(limit),
			"--non-interactive",
		],
		{ cwd: appDir, shell: WINDOWS_SHELL },
	);

	if (result.error || result.status !== 0) {
		const output = `${result.stdout}${result.stderr}`;
		if (/not authenticated|not logged in/i.test(output)) {
			throw new Error(
				"EAS authentication required. Run `eas login` or set the EXPO_TOKEN environment variable.",
			);
		}
		throw new Error(
			`Failed to fetch EAS build list for ${platform}:\n${result.error?.message ?? output.trim()}`,
		);
	}

	// eas may print warnings before the JSON array
	const lines = result.stdout.trim().split("\n");
	const jsonStart = lines.findIndex((l) => l.trim().startsWith("["));
	if (jsonStart === -1) return [];
	return JSON.parse(lines.slice(jsonStart).join("\n")) as EASBuild[];
}

/**
 * An EAS build that already used `appBuildVersion`. Android versionCode must be
 * unique across every app version on the Play Store; an iOS build number only
 * per CFBundleShortVersionString.
 */
export const findDuplicateBuild = (
	builds: EASBuild[],
	appVersion: string,
	appBuildVersion: string,
	platform: BuildPlatform,
): EASBuild | undefined =>
	builds.find(
		(b) =>
			USED_STATUSES.has(b.status) &&
			b.appBuildVersion === appBuildVersion &&
			(platform === "android" || b.appVersion === appVersion),
	);

/** The first platform whose current build version was already used, if any. */
export function findBuildCollision(
	state: BuildVersionState,
	buildsByPlatform: Map<BuildPlatform, EASBuild[]>,
): BuildCollision | undefined {
	const versions = computeBuildVersions(
		state.version,
		state.buildNumber,
		state.format,
	);
	for (const [platform, builds] of buildsByPlatform) {
		const build = findDuplicateBuild(
			builds,
			state.version,
			versions[platform],
			platform,
		);
		if (build) {
			return {
				platform,
				buildNumber: state.buildNumber,
				buildVersion: versions[platform],
				build,
			};
		}
	}
	return undefined;
}

/**
 * Increments the buildNumber until no platform collides. Returns the unique
 * buildNumber and the collisions skipped on the way; throws after
 * `maxAttempts` collisions.
 */
export function findUniqueBuildNumber(
	state: BuildVersionState,
	buildsByPlatform: Map<BuildPlatform, EASBuild[]>,
	maxAttempts: number = MAX_AUTO_INCREMENT_ATTEMPTS,
): { buildNumber: number; skipped: BuildCollision[] } {
	const skipped: BuildCollision[] = [];
	let buildNumber = state.buildNumber;

	while (skipped.length < maxAttempts) {
		const collision = findBuildCollision(
			{ ...state, buildNumber },
			buildsByPlatform,
		);
		if (!collision) return { buildNumber, skipped };
		skipped.push(collision);
		buildNumber = incrementBuildNumber(buildNumber, state.format);
	}

	throw new Error(
		`No unique buildNumber found after ${maxAttempts} attempts (last tried ${buildNumber})`,
	);
}
