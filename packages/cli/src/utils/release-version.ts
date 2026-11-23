/**
 * Release tags and versions, without side effects:
 *
 * ```
 * vX.Y.Z                      production, every app (or the single app)
 * vX.Y.Z-preview.N            preview, every app
 * <app>@vX.Y.Z                production, apps/<app> only
 * <app>@vX.Y.Z-preview.N      preview, apps/<app> only
 * ```
 */

export type ReleaseProfile = "production" | "preview";

export interface ReleaseTag {
	/** App folder name under the apps dir, for `<app>@v…` tags. */
	app?: string;
	/** `X.Y.Z`, without the `v` prefix or the prerelease. */
	version: string;
	/** `N` of `-preview.N`. */
	preview?: number;
	profile: ReleaseProfile;
}

export type Bump = "patch" | "minor" | "major";

export const BUMPS: readonly Bump[] = ["patch", "minor", "major"];

export const isBump = (value: unknown): value is Bump =>
	typeof value === "string" && (BUMPS as readonly string[]).includes(value);

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const TAG =
	/^(?:([A-Za-z0-9][\w.-]*)@)?v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))(?:-preview\.(0|[1-9]\d*))?$/;

/** Parses a release tag (a leading `refs/tags/` is ignored); throws on anything else. */
export function parseReleaseTag(input: string): ReleaseTag {
	const tag = input.trim().replace(/^refs\/tags\//, "");
	const match = TAG.exec(tag);
	if (!match) {
		throw new Error(
			`Not a release tag: "${tag}". Expected vX.Y.Z, vX.Y.Z-preview.N, <app>@vX.Y.Z or <app>@vX.Y.Z-preview.N.`,
		);
	}
	const [, app, version = "", preview] = match;
	return {
		...(app === undefined ? {} : { app }),
		version,
		...(preview === undefined ? {} : { preview: Number(preview) }),
		profile: preview === undefined ? "production" : "preview",
	};
}

/** The tag for a version, optionally scoped to one app and/or a preview number. */
export const formatReleaseTag = ({
	app,
	version,
	preview,
}: Omit<ReleaseTag, "profile">): string =>
	`${app === undefined ? "" : `${app}@`}v${version}${preview === undefined ? "" : `-preview.${preview}`}`;

const parts = (version: string): [number, number, number] => {
	const match = VERSION.exec(version);
	if (!match) throw new Error(`Not a X.Y.Z version: "${version}"`);
	return [Number(match[1]), Number(match[2]), Number(match[3])];
};

export const isVersion = (value: unknown): value is string =>
	typeof value === "string" && VERSION.test(value);

export function bumpVersion(version: string, bump: Bump): string {
	const [major, minor, patch] = parts(version);
	if (bump === "major") return `${major + 1}.0.0`;
	if (bump === "minor") return `${major}.${minor + 1}.0`;
	return `${major}.${minor}.${patch + 1}`;
}

export function compareVersions(a: string, b: string): number {
	const pa = parts(a);
	const pb = parts(b);
	for (let i = 0; i < 3; i++) {
		const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

export const maxVersion = (versions: string[]): string | undefined =>
	versions.reduce<string | undefined>(
		(max, v) => (max === undefined || compareVersions(v, max) > 0 ? v : max),
		undefined,
	);

/**
 * `1 +` the highest `-preview.N` among `existing` tags for `version`, over
 * every tag prefix in `apps` (`undefined` for the plain tag), so one release
 * gets the same N for all its tags.
 */
export function nextPreviewNumber(
	existing: string[],
	version: string,
	apps: (string | undefined)[],
): number {
	const prefixes = new Set(apps.map((app) => app ?? ""));
	let highest = 0;
	for (const tag of existing) {
		let parsed: ReleaseTag;
		try {
			parsed = parseReleaseTag(tag);
		} catch {
			continue;
		}
		if (
			parsed.preview !== undefined &&
			parsed.version === version &&
			prefixes.has(parsed.app ?? "")
		) {
			highest = Math.max(highest, parsed.preview);
		}
	}
	return highest + 1;
}
