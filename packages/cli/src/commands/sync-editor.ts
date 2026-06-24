import { join } from "node:path";
import { configPkgDir } from "../utils/config-pkg";
import { copyIfNeeded, resolveDirs } from "../utils/fs";

interface SyncEditorOptions {
	force?: boolean;
}

export const syncEditor = async (
	paths: string[],
	opts: SyncEditorOptions,
): Promise<void> => {
	const dirs = resolveDirs(paths);
	const force = opts.force ?? false;
	const editorDir = join(configPkgDir, "src", "editor");

	for (const dir of dirs) {
		console.log(`\n→ ${dir}`);
		await copyIfNeeded(
			join(editorDir, "vscode/settings.json"),
			join(dir, ".vscode/settings.json"),
			force,
		);
		await copyIfNeeded(
			join(editorDir, "zed/settings.json"),
			join(dir, ".zed/settings.json"),
			force,
		);
	}
};
