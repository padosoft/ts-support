import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
	BUILD_CODE_FORMATS,
	type BuildCodeFormat,
	isBuildCodeFormat,
} from "@padosoft/utilities/lib/build-number";
import {
	type JSONFile,
	readJSONFile,
	writeJSONFile,
} from "@padosoft/utilities/lib/json-file";

/** App config modules probed for a `buildCodeFormat` field, relative to the app dir. */
const CONFIG_CANDIDATES = [
	"src/config/index.ts",
	"src/config/index.js",
	"src/config/index.mjs",
];

export const DEFAULT_APPS_DIR = "apps";

export type AppPackageJSON = Record<string, unknown> & {
	version?: unknown;
	buildNumber?: unknown;
	buildCodeFormat?: unknown;
};

export interface AppBuildConfig {
	appName: string;
	appDir: string;
	manifest: JSONFile<AppPackageJSON>;
	version: string;
	buildNumber: number;
	format: BuildCodeFormat;
}

export const resolveAppsDir = (appsDir: string = DEFAULT_APPS_DIR): string =>
	resolve(appsDir);

export function parseBuildCodeFormat(
	value: unknown,
	source: string,
): BuildCodeFormat {
	if (isBuildCodeFormat(value)) return value;
	throw new Error(
		`Invalid buildCodeFormat ${JSON.stringify(value)} in ${source}: expected ${BUILD_CODE_FORMATS.join(" | ")}`,
	);
}

/**
 * `buildCodeFormat` of the default export of the app's `src/config/index.*`,
 * or `undefined` when there is no such file or field. Throws when the file
 * exists but cannot be imported: silently falling back to `sequential` would
 * compute the wrong versionCode (and zero a yearly counter on reset).
 */
export async function readBuildCodeFormatFromConfig(
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
		throw new Error(
			`Cannot import ${file} to read buildCodeFormat (${error instanceof Error ? error.message : String(error)}).\n` +
				`Run the CLI with bun (bunx --bun padosoft …), add "buildCodeFormat" to the app's package.json, or pass --format.`,
		);
	}
	const format = mod.default?.buildCodeFormat;
	return format === undefined ? undefined : parseBuildCodeFormat(format, file);
}

/**
 * Loads `<appsDir>/<appName>/package.json` (`version`, `buildNumber`) and
 * resolves the build code format from, in order: `formatOverride` (--format),
 * the package.json `buildCodeFormat` field, the app config module, then
 * `sequential`.
 */
export async function loadAppBuildConfig(
	appName: string,
	appsDir: string,
	formatOverride?: string,
): Promise<AppBuildConfig> {
	const appDir = resolve(appsDir, appName);
	const pkgPath = join(appDir, "package.json");
	if (!existsSync(pkgPath)) {
		throw new Error(`No package.json found for app "${appName}" at ${pkgPath}`);
	}

	const manifest = await readJSONFile<AppPackageJSON>(pkgPath);
	const { version, buildNumber, buildCodeFormat } = manifest.data;
	if (typeof version !== "string")
		throw new Error(`${pkgPath} has no "version"`);

	const format =
		formatOverride !== undefined
			? parseBuildCodeFormat(formatOverride, "--format")
			: buildCodeFormat !== undefined
				? parseBuildCodeFormat(buildCodeFormat, pkgPath)
				: ((await readBuildCodeFormatFromConfig(appDir)) ?? "sequential");

	return {
		appName,
		appDir,
		manifest,
		version,
		buildNumber: typeof buildNumber === "number" ? buildNumber : 0,
		format,
	};
}

/** Writes `config.buildNumber` back to the app's package.json, keeping its indentation. */
export async function writeBuildNumber(config: AppBuildConfig): Promise<void> {
	config.manifest.data.buildNumber = config.buildNumber;
	await writeJSONFile(config.manifest);
}
