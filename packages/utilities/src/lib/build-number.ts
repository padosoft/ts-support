/**
 * Mobile app build numbers: iOS build number / Android versionCode.
 * Pure functions, safe in every runtime.
 */

export const BUILD_CODE_FORMATS = ["sequential", "yearly", "date"] as const;
export type BuildCodeFormat = (typeof BUILD_CODE_FORMATS)[number];

export type BuildPlatform = "ios" | "android";

/** The `buildNumber` slot of the `sequential` versionCode is a single digit. */
export const SEQUENTIAL_MAX_BUILD_NUMBER = 9;

export const isBuildCodeFormat = (value: unknown): value is BuildCodeFormat =>
	typeof value === "string" &&
	(BUILD_CODE_FORMATS as readonly string[]).includes(value);

const dateAsNumber = (now: Date): number =>
	Number.parseInt(now.toISOString().slice(0, 10).replace(/-/g, ""), 10);

/**
 * Android versionCode for a semver + buildNumber.
 *
 * - `sequential`: `(major*10000 + minor*100 + patch) * 10 + buildNumber`. The
 *   buildNumber slot keeps the code unique when the semver is unchanged
 *   (`3.1.5(1)` vs `3.1.5(2)`), and is one digit: 0-9 builds per semver.
 * - `yearly`: `YYYY * 1000 + buildNumber`.
 * - `date`: `YYYYMMDD` (buildNumber ignored).
 */
export function computeVersionCode(
	version: string,
	buildNumber: number,
	format: BuildCodeFormat = "sequential",
	now: Date = new Date(),
): number {
	switch (format) {
		case "sequential": {
			if (buildNumber > SEQUENTIAL_MAX_BUILD_NUMBER) {
				throw new Error(
					`[buildCodeFormat: "sequential"] buildNumber ${buildNumber} does not fit the layout: the slot is a single digit (0-${SEQUENTIAL_MAX_BUILD_NUMBER}); beyond that it collides with the next patch (e.g. 3.1.5(10) === 3.1.6(0)). Bump the semver so the buildNumber restarts from 0.`,
				);
			}
			const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number);
			return (major * 10_000 + minor * 100 + patch) * 10 + buildNumber;
		}
		case "yearly":
			return now.getFullYear() * 1000 + buildNumber;
		case "date":
			return dateAsNumber(now);
	}
}

/** Next buildNumber for a format. `yearly` restarts at 1 once the stored year is past. */
export function incrementBuildNumber(
	buildNumber: number,
	format: BuildCodeFormat,
	now: Date = new Date(),
): number {
	if (format === "date") return dateAsNumber(now);

	const next = buildNumber + 1;
	if (format === "yearly") {
		const storedYear = Math.floor(next / 1000);
		if (storedYear > 0 && storedYear < now.getFullYear()) return 1;
	}
	return next;
}

/**
 * buildNumber after a semver bump: `sequential` restarts at 0 (the semver is
 * encoded in the versionCode), `yearly`/`date` keep increasing (their
 * versionCode is not semver-aware).
 */
export const resetBuildNumber = (
	buildNumber: number,
	format: BuildCodeFormat,
	now: Date = new Date(),
): number =>
	format === "sequential" ? 0 : incrementBuildNumber(buildNumber, format, now);

/** The build version each store sees: iOS uses buildNumber verbatim, Android the versionCode. */
export const computeBuildVersions = (
	version: string,
	buildNumber: number,
	format: BuildCodeFormat = "sequential",
	now: Date = new Date(),
): Record<BuildPlatform, string> => ({
	ios: String(buildNumber),
	android: String(computeVersionCode(version, buildNumber, format, now)),
});
