import { chalk } from "@padosoft/utilities/lib/chalk";
import { type Catalog, loadCatalog, type MigrationEntry } from "./catalog";
import {
	findManifest,
	type LoadedManifest,
	MANIFEST_PATH,
	readManifest,
} from "./manifest";
import { projectDirOf } from "./project";
import {
	type Chain,
	checkChoices,
	type MigrationPlan,
	planMigrations,
	resolveChain,
	validateChain,
} from "./resolve";
import {
	type ResolvedSource,
	resolveSource,
	type SourceOptions,
} from "./source";

/** Everything a stack command needs about the project it runs in. */
export interface Project {
	manifestPath: string;
	/** The folder holding `.padosoft/`. */
	dir: string;
	loaded: LoadedManifest;
	source: ResolvedSource;
	catalog: Catalog;
	chain: Chain;
	plan: MigrationPlan;
	unset: string[];
	/** Problems in the project's choices or in the stacks it uses. */
	problems: string[];
}

export const warn = (message: string): void => {
	console.error(`${chalk.yellow("warn")}  ${message}`);
};

export const MANIFEST_DISPLAY: string = MANIFEST_PATH.replaceAll("\\", "/");

export const requireManifest = (): string => {
	const path = findManifest();
	if (path === undefined) {
		throw new Error(`No ${MANIFEST_DISPLAY} in this folder or any parent.`);
	}
	return path;
};

export async function loadProject(
	options: SourceOptions,
	manifestPath: string = requireManifest(),
): Promise<Project> {
	const loaded = await readManifest(manifestPath);
	const source = resolveSource(options, warn);
	const catalog = await loadCatalog(source.root);
	const chain = resolveChain(catalog, loaded.manifest.stacks);
	const ids = new Set(chain.stacks.map((s) => s.id));
	const check = checkChoices(chain, loaded.manifest.choices);
	const problems = [
		...catalog.issues
			.filter((issue) => ids.has(issue.stack))
			.map((issue) => `${issue.path}: ${issue.message}`),
		...validateChain(chain),
		...check.problems,
	];
	const plan = planMigrations(
		chain,
		loaded.manifest.choices,
		loaded.manifest.applied,
	);
	for (const id of plan.unknownApplied) {
		problems.push(`applied: no stack defines migration "${id}"`);
	}
	return {
		manifestPath,
		dir: projectDirOf(manifestPath),
		loaded,
		source,
		catalog,
		chain,
		plan,
		unset: check.unset,
		problems,
	};
}

/**
 * The migration `id` if it may run now: required migrations strictly in
 * order, optional ones whenever they apply. Throws with the reason otherwise.
 */
export function runnableMigration(
	project: Project,
	id: string,
): MigrationEntry {
	if (project.loaded.manifest.applied.includes(id)) {
		throw new Error(`${id} is already applied.`);
	}
	const { required, optional } = project.plan;
	const entry = [...required, ...optional].find((e) => e.id === id);
	if (entry === undefined) {
		throw new Error(
			`${id} is not pending for this project (see \`padosoft stack plan\`).`,
		);
	}
	const first = required[0];
	if (
		entry.migration.kind === "required" &&
		first !== undefined &&
		first.id !== id
	) {
		throw new Error(
			`Apply ${first.id} first: required migrations run in order.`,
		);
	}
	return entry;
}
