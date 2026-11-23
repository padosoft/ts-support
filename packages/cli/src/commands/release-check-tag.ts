import {
	appNames,
	isOnAnyBranch,
	isOnBranch,
	releaseLocation,
	requireReleaseApps,
	tagCommit,
} from "../utils/release";
import { formatReleaseTag, parseReleaseTag } from "../utils/release-version";

interface CheckTagOptions {
	"prod-branch"?: string;
	"preview-branch"?: string;
	"apps-dir"?: string;
	app?: string;
}

/**
 * The guard of the release workflows. Checks that a pushed tag may release:
 * production tags sit on the production branch and match the apps' version;
 * preview tags sit on the preview branch (or any branch). Prints
 * `profile=`, `version=` and `apps=` lines, ready for `$GITHUB_OUTPUT`; exits
 * non-zero with the reason otherwise. Works from any folder of the repo; run
 * inside `<apps-dir>/<app>`, it checks only that app.
 */
export function releaseCheckTag(input: string, opts: CheckTagOptions): void {
	const tag = parseReleaseTag(input);
	const name = formatReleaseTag(tag);
	// The app this checks: the tag's, else --app, else the app folder it runs in.
	const scope = opts.app || releaseLocation(opts["apps-dir"]).cwdApp;
	if (tag.app !== undefined && scope && scope !== tag.app) {
		throw new Error(
			opts.app
				? `Tag ${name} is for app "${tag.app}", not "${opts.app}"`
				: `Tag ${name} is for app "${tag.app}", but this runs in the folder of app "${scope}"`,
		);
	}
	const app = tag.app ?? scope;
	const apps = requireReleaseApps(
		opts["apps-dir"],
		app === undefined ? [] : [app],
	);

	if (tag.profile === "production") {
		const mismatched = apps.packages.filter((p) => p.version !== tag.version);
		if (mismatched.length > 0) {
			throw new Error(
				`Tag ${name} does not match the version in package.json: ${mismatched
					.map(
						(p) => `${p.dirName === "." ? p.name : p.dirName} is ${p.version}`,
					)
					.join(", ")}`,
			);
		}
	}

	const commit = tagCommit(name);
	const short = commit.slice(0, 7);
	if (tag.profile === "production") {
		const branch = opts["prod-branch"] ?? "main";
		if (!isOnBranch(commit, branch)) {
			throw new Error(
				`Tag ${name} (${short}) is not on origin/${branch}: production releases come from ${branch}`,
			);
		}
	} else if (opts["preview-branch"]) {
		const branch = opts["preview-branch"];
		if (!isOnBranch(commit, branch)) {
			throw new Error(
				`Tag ${name} (${short}) is not on origin/${branch}: preview releases come from ${branch}`,
			);
		}
	} else if (!isOnAnyBranch(commit)) {
		throw new Error(`Tag ${name} (${short}) is not on any branch of origin`);
	}

	console.log(`profile=${tag.profile}`);
	console.log(`version=${tag.version}`);
	console.log(`apps=${appNames(apps).join(",")}`);
}
