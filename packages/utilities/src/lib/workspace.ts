/**
 * Node-only monorepo workspace helpers. Not re-exported from the `lib` barrel:
 * import from `@padosoft/utilities/lib/workspace`.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type PackageManifest = Record<string, unknown> & {
	name?: unknown;
	version?: unknown;
};

export interface WorkspacePackage {
	/** Directory name under the workspace root (e.g. `my-app` for `apps/my-app`). */
	dirName: string;
	dir: string;
	manifestPath: string;
	manifest: PackageManifest;
	name: string;
	version: string;
}

/**
 * Every direct subdirectory of `root` (e.g. `apps`, `packages`) with a
 * `package.json` that declares both `name` and `version`, sorted by dir name.
 */
export const readWorkspacePackages = (root: string): WorkspacePackage[] => {
	const rootDir = resolve(root);
	if (!existsSync(rootDir)) return [];

	return readdirSync(rootDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort()
		.flatMap((dirName) => {
			const dir = join(rootDir, dirName);
			const manifestPath = join(dir, "package.json");
			if (!existsSync(manifestPath)) return [];

			const manifest = JSON.parse(
				readFileSync(manifestPath, "utf8"),
			) as PackageManifest;
			const { name, version } = manifest;
			if (typeof name !== "string" || typeof version !== "string") return [];

			return [{ dirName, dir, manifestPath, manifest, name, version }];
		});
};
