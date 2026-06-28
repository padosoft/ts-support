import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { chalk } from "@padosoft/utilities/lib/chalk";
import { readJSON, writeJSON } from "../utils/fs";
import {
	type DepMap,
	formatFile,
	getTaggedVersion,
	mapLimit,
	parsePackageSpec,
	runCommand,
	sortDeps,
} from "../utils/workspace";

interface DepAddOptions {
	tag?: string;
	scope?: string;
	"dry-run"?: boolean;
	install?: boolean;
}

type RootPackageJSON = {
	workspaces?: { packages?: string[]; catalog?: DepMap };
};

type PkgJSON = {
	dependencies?: DepMap;
	devDependencies?: DepMap;
	peerDependencies?: DepMap;
};

async function resolveVersion(
	name: string,
	specVersion: string | undefined,
	flagTag: string | undefined,
): Promise<string> {
	const tagOrVersion = specVersion ?? flagTag;
	if (!tagOrVersion) {
		const v = await getTaggedVersion(name, "latest");
		if (!v) throw new Error(`Cannot resolve ${name}@latest`);
		return v;
	}
	// if it looks like a semver (starts with digit or ~^) treat as literal
	if (/^[\d~^]/.test(tagOrVersion)) return tagOrVersion;
	const v = await getTaggedVersion(name, tagOrVersion);
	if (!v) throw new Error(`Cannot resolve ${name}@${tagOrVersion}`);
	return v;
}

async function discoverWorkspaceMembers(
	cwd: string,
	scope: string,
): Promise<string[]> {
	const dirs: string[] = [];
	const candidates =
		scope === "app"
			? ["apps"]
			: scope === "package"
				? ["packages"]
				: ["apps", "packages"];
	for (const seg of candidates) {
		const dir = join(cwd, seg);
		try {
			const entries = await readdir(dir, { withFileTypes: true });
			for (const e of entries) {
				if (e.isDirectory()) dirs.push(join(dir, e.name));
			}
		} catch {
			// directory may not exist in this repo
		}
	}
	return dirs;
}

export const depAdd = async (
	pkgSpecs: string[],
	opts: DepAddOptions,
): Promise<void> => {
	const cwd = process.cwd();
	const dryRun = opts["dry-run"] ?? false;
	const scope = opts.scope ?? "all";

	if (!pkgSpecs.length) {
		console.error(`  ${chalk.red("error")}   specify at least one package`);
		process.exit(1);
	}

	console.log(`\nResolving ${pkgSpecs.length} package(s)…\n`);

	const resolved = await mapLimit(pkgSpecs, 8, async (spec) => {
		const { name, version } = parsePackageSpec(spec);
		const resolvedVersion = await resolveVersion(name, version, opts.tag);
		return { name, version: resolvedVersion };
	});

	for (const { name, version } of resolved) {
		console.log(`  ${chalk.green("resolved")}  ${name}@${version}`);
	}

	if (dryRun) {
		console.log(`\n${chalk.dim("dry-run")}  would update root catalog and workspace member dependencies.\n`);
		return;
	}

	// 1. Update root catalog
	const rootPath = join(cwd, "package.json");
	const root = await readJSON<RootPackageJSON>(rootPath);
	root.workspaces ??= {};
	root.workspaces.catalog ??= {};
	for (const { name, version } of resolved) {
		root.workspaces.catalog[name] = version;
	}
	root.workspaces.catalog = sortDeps(root.workspaces.catalog);
	await writeJSON(rootPath, root);
	console.log(`\n  ${chalk.green("updated")}  package.json (catalog)`);

	// 2. Update workspace members
	const memberDirs = await discoverWorkspaceMembers(cwd, scope);
	const touchedFiles: string[] = [rootPath];

	for (const dir of memberDirs) {
		const pkgPath = join(dir, "package.json");
		try {
			const pkg = await readJSON<PkgJSON>(pkgPath);
			pkg.dependencies ??= {};
			for (const { name } of resolved) {
				pkg.dependencies[name] = "catalog:";
			}
			pkg.dependencies = sortDeps(pkg.dependencies);
			await writeJSON(pkgPath, pkg);
			touchedFiles.push(pkgPath);
			console.log(`  ${chalk.green("updated")}  ${pkgPath.replace(`${cwd}/`, "")}`);
		} catch {
			// skip directories without package.json
		}
	}

	// 3. Format all touched files
	await Promise.all(touchedFiles.map(formatFile));

	if (opts.install) {
		console.log(`\n  ${chalk.cyan("running")}  bun install…`);
		await runCommand("bun", ["install"]);
	}

	console.log(`\n${chalk.green("Done.")} Added ${resolved.length} dep(s) to catalog.\n`);
};
