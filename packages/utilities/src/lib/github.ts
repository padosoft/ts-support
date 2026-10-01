/**
 * Node-only GitHub helpers built on an authenticated `gh` CLI. Not re-exported
 * from the `lib` barrel: import from `@padosoft/utilities/lib/github`.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run, runOrThrow } from "./process";

export interface GithubReleaseOptions {
	tag: string;
	/** @default tag */
	title?: string;
	notes: string;
	/** Fail if the tag is not already on the remote. @default true */
	verifyTag?: boolean;
	cwd?: string;
}

/** Whether a GitHub Release exists for the tag. */
export const githubReleaseExists = (tag: string, cwd?: string): boolean =>
	run("gh", ["release", "view", tag], { cwd }).status === 0;

/** Creates a GitHub Release; the notes go through a temp file so any length/markdown is safe. */
export const createGithubRelease = ({
	tag,
	title = tag,
	notes,
	verifyTag = true,
	cwd,
}: GithubReleaseOptions): void => {
	const dir = mkdtempSync(join(tmpdir(), "gh-release-notes-"));
	try {
		const notesPath = join(dir, "notes.md");
		writeFileSync(notesPath, `${notes}\n`);
		runOrThrow(
			"gh",
			[
				"release",
				"create",
				tag,
				"--title",
				title,
				"--notes-file",
				notesPath,
				...(verifyTag ? ["--verify-tag"] : []),
			],
			{ cwd },
		);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
};
