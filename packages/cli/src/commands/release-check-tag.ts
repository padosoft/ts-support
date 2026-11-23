import {
	appNames,
	isOnAnyBranch,
	isOnBranch,
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
 * non-zero with the reason otherwise.
 */
export function releaseCheckTag(input: string, opts: CheckTagOptions): void {
	const tag = parseReleaseTag(input);
	const name = formatReleaseTag(tag);
	if (tag.app !== undefined && opts.app && opts.app !== tag.app) {
		throw new Error(`Tag ${name} is for app "${tag.app}", not "${opts.app}"`);
	}
	const app = tag.app ?? opts.app;
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
