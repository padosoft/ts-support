import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const BUILD_CODE_FORMATS = ["sequential", "yearly", "date"] as const;
export type BuildCodeFormat = (typeof BUILD_CODE_FORMATS)[number];

export type Platform = "ios" | "android";

/** The `buildNumber` slot of the `sequential` versionCode is a single digit. */
export const SEQUENTIAL_MAX_BUILD_NUMBER = 9;

/** App config modules probed for a `buildCodeFormat` field, relative to the app dir. */
const CONFIG_CANDIDATES = [
	"src/config/index.ts",
	"src/config/index.js",
	"src/config/index.mjs",
];

type AppPackageJSON = Record<string, unknown> & {
	version?: unknown;
	buildNumber?: unknown;
	buildCodeFormat?: unknown;
};

export interface AppBuildConfig {
	appName: string;
	appDir: string;
	pkgPath: string;
	pkg: AppPackageJSON;
	indent: string;
	version: string;
	buildNumber: number;
	format: BuildCodeFormat;
}

export interface EASBuild {
	id: string;
	status: string;
	platform: string;
	appVersion: string;
	appBuildVersion: string;
	channel: string;
}

export const isBuildCodeFormat = (value: unknown): value is BuildCodeFormat =>
	typeof value === "string" &&
	(BUILD_CODE_FORMATS as readonly string[]).includes(value);

const todayAsNumber = (now: Date): number =>
	Number.parseInt(now.toISOString().slice(0, 10).replace(/-/g, ""), 10);

/**
 * Android versionCode for a given semver + buildNumber.
 *
 * - `sequential`: `(major*10k + minor*100 + patch) * 10 + buildNumber` — the
 *   buildNumber slot is one digit, so 0-9 builds per semver.
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
					`[buildCodeFormat: "sequential"] buildNumber ${buildNumber} does not fit: the slot is ONE digit (0-${SEQUENTIAL_MAX_BUILD_NUMBER}), beyond that it collides with the next patch (e.g. 3.1.5(10) === 3.1.6(0)). Bump the semver: buildNumber restarts from 0.`,
				);
			}
			const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number);
			return (major * 10_000 + minor * 100 + patch) * 10 + buildNumber;
		}
		case "yearly":
			return now.getFullYear() * 1000 + buildNumber;
		case "date":
			return todayAsNumber(now);
	}
}

export function incrementBuildNumber(
	buildNumber: number,
	format: BuildCodeFormat,
	now: Date = new Date(),
): number {
	if (format === "date") return todayAsNumber(now);

	const next = buildNumber + 1;
	if (format === "yearly") {
		const storedYear = Math.floor(next / 1000);
		if (storedYear > 0 && storedYear < now.getFullYear()) return 1;
	}
	return next;
}

/** The build numbers EAS reports for each platform: iOS uses it verbatim, Android the versionCode. */
export const computeBuildVersions = (
	config: Pick<AppBuildConfig, "version" | "buildNumber" | "format">,
): Record<Platform, string> => ({
	ios: String(config.buildNumber),
	android: String(
		computeVersionCode(config.version, config.buildNumber, config.format),
	),
});

const USED_STATUSES = new Set(["FINISHED", "NEW", "IN_QUEUE", "IN_PROGRESS"]);

/**
 * An EAS build that already used `appBuildVersion`. Android versionCode must be
 * unique across every app version on the Play Store; an iOS build number only
 * per CFBundleShortVersionString.
 */
export const findDuplicateBuild = (
	builds: EASBuild[],
	appVersion: string,
	appBuildVersion: string,
	platform: Platform,
): EASBuild | undefined =>
	builds.find(
		(b) =>
			USED_STATUSES.has(b.status) &&
			b.appBuildVersion === appBuildVersion &&
			(platform === "android" || b.appVersion === appVersion),
	);

const detectIndent = (json: string): string =>
	/^[{[]\r?\n([ \t]+)/.exec(json)?.[1] ?? "\t";

async function readFormatFromConfig(
	appDir: string,
): Promise<BuildCodeFormat | undefined> {
	const file = CONFIG_CANDIDATES.map((c) => join(appDir, c)).find((f) =>
		existsSync(f),
	);
	if (!file) return undefined;

	let mod: { default?: { buildCodeFormat?: unknown } };
	try {
		mod = (await import(pathToFileURL(file).href)) as typeof mod;
	} catch (error) {
		// A silent fallback to "sequential" would compute the wrong versionCode
		// (and `build reset` would zero a yearly counter), so this is fatal.
		throw new Error(
			`Cannot import ${file} to read buildCodeFormat (${error instanceof Error ? error.message : String(error)}).\n` +
				`Run the CLI with bun (bunx --bun padosoft …), add "buildCodeFormat" to the app's package.json, or pass --format.`,
		);
	}
	return mod.default?.buildCodeFormat === undefined
		? undefined
		: parseFormat(mod.default.buildCodeFormat, file);
}

function parseFormat(value: unknown, source: string): BuildCodeFormat {
	if (isBuildCodeFormat(value)) return value;
	throw new Error(
		`Invalid buildCodeFormat ${JSON.stringify(value)} in ${source}: expected ${BUILD_CODE_FORMATS.join(" | ")}`,
	);
}

/**
 * Loads `<appsDir>/<appName>/package.json` (`version`, `buildNumber`) and
 * resolves the build code format from, in order: `formatOverride` (--format),
 * the package.json `buildCodeFormat` field, the `buildCodeFormat` of the app's
 * `src/config/index.{ts,js,mjs}` default export, then `sequential`.
 */
export async function loadAppBuildConfig(
	appName: string,
	appsDir: string,
	formatOverride?: string,
): Promise<AppBuildConfig> {
	const appDir = resolve(appsDir, appName);
	const pkgPath = join(appDir, "package.json");
	if (!existsSync(pkgPath))
		throw new Error(`No package.json found for app "${appName}" at ${pkgPath}`);

	const raw = await readFile(pkgPath, "utf8");
	const pkg = JSON.parse(raw) as AppPackageJSON;
	if (typeof pkg.version !== "string")
		throw new Error(`${pkgPath} has no "version"`);

	const format =
		formatOverride !== undefined
			? parseFormat(formatOverride, "--format")
			: pkg.buildCodeFormat !== undefined
				? parseFormat(pkg.buildCodeFormat, pkgPath)
				: ((await readFormatFromConfig(appDir)) ?? "sequential");

	return {
		appName,
		appDir,
		pkgPath,
		pkg,
		indent: detectIndent(raw),
		version: pkg.version,
		buildNumber: typeof pkg.buildNumber === "number" ? pkg.buildNumber : 0,
		format,
	};
}

export async function writeBuildNumber(config: AppBuildConfig): Promise<void> {
	config.pkg.buildNumber = config.buildNumber;
	await writeFile(
		config.pkgPath,
		`${JSON.stringify(config.pkg, null, config.indent)}\n`,
		"utf8",
	);
}
