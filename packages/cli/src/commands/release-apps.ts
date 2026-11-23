import { chalk } from "@padosoft/utilities/lib/chalk";
import {
	publishRelease,
	releaseNotes,
	resolveReleaseApps,
} from "../utils/release";

interface ReleaseAppsOptions {
	"dry-run"?: boolean;
	"apps-dir"?: string;
	"tag-format"?: string;
}

const TAG_FORMATS = ["auto", "version", "name"] as const;
type TagFormat = (typeof TAG_FORMATS)[number];

const isTagFormat = (value: unknown): value is TagFormat =>
	typeof value === "string" &&
	(TAG_FORMATS as readonly string[]).includes(value);

/**
 * Tags the apps at their current version and publishes the GitHub Release with
 * that version's CHANGELOG section. Meant to run after the changesets "version
 * packages" PR merges. Idempotent. Requires `git` with an `origin` remote and
 * an authenticated `gh`.
 *
 * The tag is `v<version>` when the apps share one version (one app, or a
 * changesets fixed group), which is what the release workflows listen to;
 * `<name>@<version>` per app otherwise, or always with `--tag-format name`.
 */
export function releaseApps(opts: ReleaseAppsOptions): void {
	const dryRun = opts["dry-run"] ?? false;
	const format = opts["tag-format"] ?? "auto";
	if (!isTagFormat(format)) {
		throw new Error(
			`--tag-format must be one of ${TAG_FORMATS.join(", ")}, got "${format}"`,
		);
	}

	const { packages, appsDir } = resolveReleaseApps(opts["apps-dir"]);
	if (packages.length === 0) {
		console.log(
			`\n${chalk.dim(`No apps with name + version found in ${appsDir} or ./package.json`)}\n`,
		);
		return;
	}

	const versions = [...new Set(packages.map((p) => p.version))];
	if (format === "version" && versions.length > 1) {
		throw new Error(
			`--tag-format version needs one shared version, the apps have ${packages.map((p) => `${p.name}@${p.version}`).join(", ")}`,
		);
	}
	const [shared] = versions;

	console.log(
		`\n${dryRun ? "Dry run: releasing" : "Releasing"} ${packages.length} app(s)…\n`,
	);
	if (format !== "name" && versions.length === 1 && shared !== undefined) {
		const tag = `v${shared}`;
		publishRelease(
			{
				tag,
				notes: releaseNotes(packages, tag),
				label: packages.map((p) => p.name).join(", "),
			},
			dryRun,
		);
	} else {
		if (format === "auto") {
			console.log(
				chalk.dim("  The apps have different versions: one tag per app.\n"),
			);
		}
		for (const pkg of packages) {
			const tag = `${pkg.name}@${pkg.version}`;
			publishRelease(
				{ tag, notes: releaseNotes([pkg], tag), label: pkg.name },
				dryRun,
			);
		}
	}
	console.log("");
}
