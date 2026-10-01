/**
 * Node-only git helpers. Not re-exported from the `lib` barrel:
 * import from `@padosoft/utilities/lib/git`.
 */
import { runOrThrow } from "./process";

export interface GitOptions {
	/** Remote name. @default "origin" */
	remote?: string;
	cwd?: string;
}

/** Whether `refs/tags/<tag>` exists on the remote. */
export const remoteTagExists = (
	tag: string,
	{ remote = "origin", cwd }: GitOptions = {},
): boolean =>
	runOrThrow("git", ["ls-remote", "--tags", remote, `refs/tags/${tag}`], {
		cwd,
	}).trim().length > 0;

/** Creates an annotated tag on HEAD. */
export const createAnnotatedTag = (
	tag: string,
	message: string = tag,
	{ cwd }: GitOptions = {},
): void => {
	runOrThrow("git", ["tag", "-a", tag, "-m", message], { cwd });
};

/** Pushes a single tag to the remote. */
export const pushTag = (
	tag: string,
	{ remote = "origin", cwd }: GitOptions = {},
): void => {
	runOrThrow("git", ["push", remote, `refs/tags/${tag}`], { cwd });
};
