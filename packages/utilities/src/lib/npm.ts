/**
 * Node-only npm registry helpers. Not re-exported from the `lib` barrel:
 * import from `@padosoft/utilities/lib/npm`.
 */
import type { ChildProcess } from "node:child_process";
import { spawnProcess, WINDOWS_SHELL } from "./process";

/**
 * Version behind `<pkg>@<tag>` (dist-tag or exact version) via `npm view`,
 * or `null` when it does not resolve.
 */
export const getTaggedVersion = (
	pkg: string,
	tag: string,
): Promise<string | null> => {
	let child: ChildProcess;
	try {
		// npm is npm.cmd on Windows and needs a shell there; spawnProcess
		// rejects specs with shell-active characters.
		child = spawnProcess("npm", ["view", `${pkg}@${tag}`, "version"], {
			stdio: ["ignore", "pipe", "ignore"],
			shell: WINDOWS_SHELL,
		});
	} catch {
		return Promise.resolve(null);
	}

	return new Promise((resolve) => {
		const chunks: Buffer[] = [];
		child.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk));
		child.on("close", () => {
			const result = Buffer.concat(chunks).toString("utf8").trim();
			resolve(result || null);
		});
		child.on("error", () => resolve(null));
	});
};
