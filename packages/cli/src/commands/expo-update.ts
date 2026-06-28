import { join } from "node:path";
import { chalk } from "@padosoft/utilities/lib/chalk";
import { readJSON, writeJSON } from "../utils/fs";
import { type DepMap, formatFile, getTaggedVersion, mapLimit } from "../utils/workspace";

interface ExpoUpdateOptions {
	tag?: string;
	exclude?: string;
}

const DEFAULT_EXCLUDED = ["expo-atlas", "expo-quick-actions"];

type PkgJSON = {
	dependencies?: DepMap;
	devDependencies?: DepMap;
	overrides?: DepMap;
	patchedDependencies?: Record<string, string>;
	workspaces?: { catalog?: DepMap };
};

function isExpoPackage(name: string): boolean {
	return (
		name === "expo" ||
		name.startsWith("expo-") ||
		name.startsWith("@expo/") ||
		name.endsWith("-expo")
	);
}

function isCatalog(value: string): boolean {
	return value.startsWith("catalog:");
}

export const expoUpdate = async (opts: ExpoUpdateOptions): Promise<void> => {
	const cwd = process.cwd();
	const tag = opts.tag ?? "canary";
	const excluded = new Set(
		opts.exclude
			? opts.exclude
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean)
			: DEFAULT_EXCLUDED,
	);

	const pkgPath = join(cwd, "package.json");
	const pkg = await readJSON<PkgJSON>(pkgPath);

	// Collect all unique expo package names across all sections
	const expoNames = new Set<string>();
	const collectSection = (deps: DepMap | undefined) => {
		if (!deps) return;
		for (const name of Object.keys(deps)) {
			if (isExpoPackage(name) && !excluded.has(name)) expoNames.add(name);
		}
	};
	collectSection(pkg.dependencies);
	collectSection(pkg.devDependencies);
	collectSection(pkg.overrides);
	collectSection(pkg.workspaces?.catalog);

	if (expoNames.size === 0) {
		console.log(`\n${chalk.dim("No Expo packages found in package.json")}\n`);
		return;
	}

	console.log(`\nFetching ${expoNames.size} Expo package(s) @ ${chalk.cyan(tag)}…\n`);
	if (excluded.size) {
		console.log(`  ${chalk.dim("excluding")}  ${[...excluded].join(", ")}\n`);
	}

	const pairs = await mapLimit([...expoNames], 8, async (name) => {
		const version = await getTaggedVersion(name, tag);
		return [name, version] as const;
	});
	const versionMap = new Map(
		pairs.filter((p): p is [string, string] => p[1] !== null),
	);

	let changed = false;

	const applySection = (
		label: string,
		deps: DepMap | undefined,
		skipCatalog = true,
	): void => {
		if (!deps) return;
		for (const [name, newVersion] of versionMap) {
			if (!(name in deps)) continue;
			if (skipCatalog && isCatalog(deps[name] ?? "")) {
				console.log(`  ${chalk.dim("skip")}     [${label}] ${name} (catalog:)`);
				continue;
			}
			deps[name] = newVersion;
			changed = true;
			console.log(`  ${chalk.green("updated")}  [${label}] ${name} → ${newVersion}`);
		}
	};

	applySection("dependencies", pkg.dependencies);
	applySection("devDependencies", pkg.devDependencies);
	applySection("overrides", pkg.overrides);
	applySection("catalog", pkg.workspaces?.catalog, false);

	// patchedDependencies uses "name@version" as key — rename matching keys
	if (pkg.patchedDependencies) {
		const patched = pkg.patchedDependencies;
		for (const key of Object.keys(patched)) {
			const at = key.lastIndexOf("@");
			if (at === -1) continue;
			const name = key.slice(0, at);
			const newVersion = versionMap.get(name);
			if (!newVersion || !isExpoPackage(name) || excluded.has(name)) continue;
			const nextKey = `${name}@${newVersion}`;
			if (nextKey === key) continue;
			patched[nextKey] = patched[key] as string;
			delete patched[key];
			changed = true;
			console.log(`  ${chalk.green("updated")}  [patchedDependencies] ${key} → ${nextKey}`);
		}
	}

	if (!changed) {
		console.log(`\n${chalk.dim("No Expo packages updated")} (tag=${tag})\n`);
		return;
	}

	await writeJSON(pkgPath, pkg);
	await formatFile(pkgPath);
	console.log(`\n${chalk.green("Done.")}\n`);
};
