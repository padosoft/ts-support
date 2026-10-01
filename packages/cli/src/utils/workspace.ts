import { runCommand } from "@padosoft/utilities/lib/process";

export type DepMap = Record<string, string>;

export function sortDeps(deps: DepMap): DepMap {
	return Object.fromEntries(
		Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)),
	);
}

export async function formatFile(filePath: string): Promise<void> {
	await runCommand("bunx", ["biome", "format", filePath, "--write"]);
}

export function parsePackageSpec(spec: string): {
	name: string;
	version?: string;
} {
	// handles: expo | expo@beta | expo@1.2.3 | @scope/pkg@1.0.0
	const at = spec.lastIndexOf("@");
	if (at <= 0) return { name: spec };
	return { name: spec.slice(0, at), version: spec.slice(at + 1) };
}

/** Whether a dependency spec is a workspace catalog reference (`catalog:` / `catalog:<name>`). */
export function isCatalog(value: string): boolean {
	return value.startsWith("catalog:");
}
