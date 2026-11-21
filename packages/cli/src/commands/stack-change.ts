import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { chalk } from "@padosoft/utilities/lib/chalk";
import type { MigrationEntry, RecipeEntry } from "../stack/catalog";
import { loadCatalog } from "../stack/catalog";
import {
	loadProject,
	type Project,
	runnableMigration,
	warn,
} from "../stack/load";
import {
	createManifest,
	MANIFEST_PATH,
	writeManifest,
} from "../stack/manifest";
import {
	changeDeps,
	copyFiles,
	installedPackages,
	mergeJsonFiles,
	packageName,
	readSteps,
	runCodemod,
	runVerify,
} from "../stack/project";
import {
	type AxisEntry,
	type Chain,
	checkChoices,
	findRecipe,
	INIT_RECIPE,
	listRecipes,
	resolveChain,
	validateChain,
} from "../stack/resolve";
import type { StackManifest } from "../stack/schemas";
import { resolveSource, type SourceOptions } from "../stack/source";
import { isInteractive, select } from "../utils/prompt";

const printSteps = (dir: string, title: string): void => {
	const steps = readSteps(dir);
	if (steps === undefined) return;
	console.log(
		`\n${chalk.bold(`Steps for ${title}`)} ${chalk.dim(`(${join(dir, "steps.md")})`)}\n`,
	);
	console.log(steps.trimEnd());
};

// ── migrations ───────────────────────────────────────────────────────────────

/** Runs the deterministic part of a migration: packages, then the codemod. */
export async function stackMigrate(
	id: string,
	options: SourceOptions,
): Promise<void> {
	const project = await loadProject(options);
	const entry = runnableMigration(project, id);
	console.log(`\n${chalk.bold(entry.id)}  ${entry.migration.title}\n`);
	await changeDeps(project.dir, entry.migration.deps);
	const ran = await runCodemod(entry.dir, project.dir);
	if (!ran && readSteps(entry.dir) === undefined) {
		console.log(chalk.dim("  No codemod and no steps."));
	}
	printSteps(entry.dir, entry.id);
	console.log(
		`\n${chalk.dim(`Then: \`padosoft stack mark ${entry.id}\` (runs its verify commands first).`)}\n`,
	);
}

const verifyOrThrow = (project: Project, entry: MigrationEntry): void => {
	const failed = runVerify(entry.migration.verify, project.dir);
	if (failed !== undefined) {
		throw new Error(
			`Verify failed for ${entry.id}: \`${failed}\`. Fix it, then retry.`,
		);
	}
};

/** Runs a pending migration's verify commands. */
export async function stackVerify(
	id: string,
	options: SourceOptions,
): Promise<void> {
	const project = await loadProject(options);
	const entry = runnableMigration(project, id);
	if (entry.migration.verify.length === 0) {
		console.log(chalk.dim(`\n  ${entry.id} has no verify commands.\n`));
		return;
	}
	verifyOrThrow(project, entry);
	console.log(`\n  ${chalk.green("verified")}  ${entry.id}\n`);
}

/** Runs a migration's verify commands, then records it as applied with the choices it sets. */
export async function stackMark(
	id: string,
	options: SourceOptions,
): Promise<void> {
	const project = await loadProject(options);
	const entry = runnableMigration(project, id);
	verifyOrThrow(project, entry);
	const { manifest } = project.loaded;
	await writeManifest(project.loaded, {
		...manifest,
		choices: { ...manifest.choices, ...entry.migration.set },
		applied: [...manifest.applied, id],
	});
	console.log(`\n  ${chalk.green("marked")}  ${id}\n`);
}

// ── recipes ──────────────────────────────────────────────────────────────────

interface ApplyOptions extends SourceOptions {
	force?: boolean;
}

async function applyRecipe(
	dir: string,
	entry: RecipeEntry,
	force: boolean,
): Promise<void> {
	console.log(
		`\n${chalk.bold(`${entry.stack}/${entry.name}`)}  ${entry.recipe.title}`,
	);
	await changeDeps(dir, entry.recipe.deps);
	await copyFiles(join(entry.dir, "files"), dir, force);
	await mergeJsonFiles(dir, entry.recipe.merge);
	printSteps(entry.dir, `${entry.stack}/${entry.name}`);
}

/** What applying a recipe records in the manifest; throws when it would contradict a recorded choice. */
function recordRecipe(
	manifest: StackManifest,
	entry: RecipeEntry,
): StackManifest {
	const { target } = entry;
	if (target.kind === "choice") {
		const current = manifest.choices[target.axis];
		if (current !== undefined && current !== target.option) {
			throw new Error(
				`This project uses ${target.axis}=${current}: switching to ${target.option} is a migration, not a recipe.`,
			);
		}
		return {
			...manifest,
			choices: { ...manifest.choices, [target.axis]: target.option },
		};
	}
	if (
		target.kind === "feature" &&
		!manifest.features.includes(target.feature)
	) {
		return { ...manifest, features: [...manifest.features, target.feature] };
	}
	return manifest;
}

/** Applies a recipe and records the choice or feature it stands for. */
export async function stackApply(
	name: string,
	options: ApplyOptions,
): Promise<void> {
	const project = await loadProject(options);
	const entry = findRecipe(project.chain, name);
	if (entry === undefined) {
		const names = listRecipes(project.chain)
			.map((r) => r.name)
			.filter((n) => n !== INIT_RECIPE);
		throw new Error(
			`Unknown recipe "${name}" (available: ${names.join(", ") || "none"})`,
		);
	}
	// Checked before touching the project: a contradicting choice stops here.
	const next = recordRecipe(project.loaded.manifest, entry);
	await applyRecipe(project.dir, entry, options.force ?? false);
	if (next !== project.loaded.manifest) {
		await writeManifest(project.loaded, next);
		console.log(`\n  ${chalk.green("recorded")}  ${name}`);
	}
	console.log("");
}

// ── init ─────────────────────────────────────────────────────────────────────

interface InitOptions extends SourceOptions {
	stack?: string | string[];
	choice?: string | string[];
	feature?: string | string[];
	defaults?: boolean;
	force?: boolean;
}

/** `--x a --x b,c` → `["a", "b", "c"]`: sade gives a string for one flag, an array for several. */
const toList = (value: string | string[] | undefined): string[] =>
	(Array.isArray(value) ? value : value === undefined ? [] : [value])
		.flatMap((v) => String(v).split(","))
		.map((v) => v.trim())
		.filter((v) => v.length > 0);

/** An axis and its options with when to pick each, for a human or an agent choosing. */
function describeAxis(axis: string, entry: AxisEntry): string {
	const lines = [
		`  ${axis}${entry.description ? ` — ${entry.description}` : ""}`,
	];
	for (const option of entry.options) {
		const marker = option === entry.default ? " (default)" : "";
		const why = entry.descriptions[option];
		lines.push(`    ${option}${marker}${why ? `: ${why}` : ""}`);
	}
	return lines.join("\n");
}

async function pickChoices(
	chain: Chain,
	given: Record<string, string>,
	useDefaults: boolean,
): Promise<Record<string, string>> {
	const choices = { ...given };
	const missing: string[] = [];
	for (const [axis, entry] of chain.axes) {
		if (axis in choices) continue;
		if (isInteractive()) {
			const ordered =
				entry.default === undefined
					? entry.options
					: [
							entry.default,
							...entry.options.filter((o) => o !== entry.default),
						];
			choices[axis] = await select(
				`${axis}${entry.description ? chalk.dim(` — ${entry.description}`) : ""}`,
				ordered.map((value) => {
					const hint = [
						value === entry.default ? "default" : "",
						entry.descriptions[value] ?? "",
					]
						.filter(Boolean)
						.join(" · ");
					return { value, ...(hint ? { hint } : {}) };
				}),
			);
		} else if (useDefaults && entry.default !== undefined) {
			choices[axis] = entry.default;
		} else {
			missing.push(describeAxis(axis, entry));
		}
	}
	if (missing.length > 0) {
		// Also the guide an agent relays to the user before choosing.
		throw new Error(
			`Choose an option for every axis${useDefaults ? " without a default" : " (or pass --defaults)"}, with --choice <axis>=<option>:\n\n${missing.join("\n\n")}`,
		);
	}
	return choices;
}

/**
 * Creates `.padosoft/stack.json` in the current folder and applies the stacks'
 * `init` recipes, then the recipe of every choice and feature that has one.
 * Every existing migration is recorded as applied: a new project starts at the
 * current state of its stacks.
 */
export async function stackInit(options: InitOptions): Promise<void> {
	const dir = process.cwd();
	const manifestPath = join(dir, MANIFEST_PATH);
	if (existsSync(manifestPath)) {
		throw new Error(
			`${manifestPath} already exists: use \`padosoft stack apply\` to add to it.`,
		);
	}
	const stacks = toList(options.stack);
	if (stacks.length === 0)
		throw new Error(
			"Pass --stack <id> (repeat or comma-separate for several).",
		);

	const source = resolveSource(options, warn);
	const catalog = await loadCatalog(source.root);
	const chain = resolveChain(catalog, stacks);
	const ids = new Set(chain.stacks.map((s) => s.id));
	const broken = [
		...catalog.issues
			.filter((i) => ids.has(i.stack))
			.map((i) => `${i.path}: ${i.message}`),
		...validateChain(chain),
	];
	if (broken.length > 0)
		throw new Error(`The stacks have problems:\n  ${broken.join("\n  ")}`);

	const given: Record<string, string> = {};
	for (const pair of toList(options.choice)) {
		const [axis, option, ...rest] = pair.split("=");
		if (!axis || !option || rest.length > 0)
			throw new Error(`--choice expects axis=option, got "${pair}"`);
		given[axis] = option;
	}
	const invalid = checkChoices(chain, given).problems;
	if (invalid.length > 0) throw new Error(invalid.join("; "));
	const choices = await pickChoices(chain, given, options.defaults ?? false);
	const features = toList(options.feature);

	const manifest: StackManifest = {
		$schema: "../node_modules/@padosoft/cli/schema/stack-manifest.json",
		stacks,
		choices,
		features,
		applied: chain.stacks.flatMap((s) => s.migrations.map((m) => m.id)),
	};

	const recipes = listRecipes(chain);
	const toApply = [
		...recipes.filter((r) => r.name === INIT_RECIPE),
		...[...chain.axes.keys()].flatMap((axis) =>
			recipes.filter((r) => r.name === `${axis}/${choices[axis]}`),
		),
		...features.flatMap((f) =>
			recipes.filter((r) => r.name === `feature/${f}`),
		),
	];
	for (const entry of toApply)
		await applyRecipe(dir, entry, options.force ?? false);

	// Written last, so a failed recipe can be fixed and `stack init` run again.
	await createManifest(manifestPath, manifest);
	console.log(`\n  ${chalk.green("create")}  ${resolve(manifestPath)}\n`);
}

// ── doctor ───────────────────────────────────────────────────────────────────

/**
 * Packages a recipe owns: present when its choice or feature is recorded,
 * absent when another option of the same axis is chosen.
 */
function dependencyFindings(project: Project): string[] {
	const findings: string[] = [];
	const { choices, features } = project.loaded.manifest;
	const installed = installedPackages(project.dir);
	const owned = (entry: RecipeEntry) =>
		[...entry.recipe.deps.add, ...entry.recipe.deps.dev].map(packageName);

	const expected = new Set<string>();
	for (const entry of listRecipes(project.chain)) {
		const { target } = entry;
		const active =
			(target.kind === "choice" && choices[target.axis] === target.option) ||
			(target.kind === "feature" && features.includes(target.feature));
		if (!active) continue;
		for (const name of owned(entry)) {
			expected.add(name);
			if (!installed.has(name))
				findings.push(`${name} is missing (recipe ${entry.name})`);
		}
	}
	for (const entry of listRecipes(project.chain)) {
		const { target } = entry;
		if (target.kind !== "choice") continue;
		const chosen = choices[target.axis];
		if (chosen === undefined || chosen === target.option) continue;
		for (const name of owned(entry)) {
			if (installed.has(name) && !expected.has(name)) {
				findings.push(
					`${name} belongs to ${target.axis}=${target.option}, but the project uses ${target.axis}=${chosen}`,
				);
			}
		}
	}
	return findings;
}

/** Fails when the project has drifted from its stacks; meant for CI. */
export async function stackDoctor(
	options: SourceOptions & { json?: boolean },
): Promise<void> {
	const project = await loadProject(options);
	const findings = [
		...project.problems,
		...project.unset.map((axis) => `no option recorded for axis "${axis}"`),
		...project.plan.required.map((m) => `required migration pending: ${m.id}`),
		...dependencyFindings(project),
	];
	if (options.json) {
		console.log(
			JSON.stringify({ ok: findings.length === 0, findings }, null, 2),
		);
	} else {
		console.log("");
		for (const finding of findings)
			console.log(`  ${chalk.red("drift")}  ${finding}`);
		console.log(
			findings.length === 0
				? `  ${chalk.green("The project matches its stacks.")}\n`
				: `\n  ${chalk.red(`${findings.length} finding(s)`)}\n`,
		);
	}
	if (findings.length > 0) process.exitCode = 1;
}
