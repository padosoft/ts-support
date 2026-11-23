import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { chalk } from "@padosoft/utilities/lib/chalk";
import { loadCatalog, type MigrationEntry } from "../stack/catalog";
import { renderContext } from "../stack/context";
import {
	loadProject,
	MANIFEST_DISPLAY,
	requireManifest,
	warn,
} from "../stack/load";
import { findManifest } from "../stack/manifest";
import { isCodemodPackage, testCodemod } from "../stack/project";
import {
	listSkills,
	resolveChain,
	selectRules,
	validateChain,
} from "../stack/resolve";
import {
	type ResolvedSource,
	resolveSource,
	type SourceOptions,
} from "../stack/source";

interface CommonOptions extends SourceOptions {
	json?: boolean;
}

const describeSource = (source: ResolvedSource): string => {
	if (source.kind === "local") return `${source.spec} (local folder)`;
	if (source.fetchedAt === undefined) return `${source.spec} (cached)`;
	const minutes = Math.round(
		(Date.now() - source.fetchedAt.getTime()) / 60_000,
	);
	const age = minutes < 60 ? `${minutes}m` : `${Math.round(minutes / 60)}h`;
	return `${source.spec} (fetched ${age} ago)`;
};

const migrationSummary = (entry: MigrationEntry) => ({
	id: entry.id,
	title: entry.migration.title,
	kind: entry.migration.kind,
	dir: entry.dir,
	set: entry.migration.set,
	deps: entry.migration.deps,
	verify: entry.migration.verify,
	steps: existsSync(join(entry.dir, "steps.md"))
		? join(entry.dir, "steps.md")
		: undefined,
});

// ── status ───────────────────────────────────────────────────────────────────

export async function stackStatus(options: CommonOptions): Promise<void> {
	const project = await loadProject(options);
	const { manifest } = project.loaded;
	const summary = {
		manifest: project.manifestPath,
		source: {
			spec: project.source.spec,
			kind: project.source.kind,
			fetchedAt: project.source.fetchedAt?.toISOString(),
		},
		stacks: project.chain.stacks.map((s) => s.id),
		choices: manifest.choices,
		unset: project.unset,
		features: manifest.features,
		applied: manifest.applied,
		pending: {
			required: project.plan.required.map((e) => e.id),
			optional: project.plan.optional.map((e) => e.id),
		},
		problems: project.problems,
	};
	if (options.json) {
		console.log(JSON.stringify(summary, null, 2));
	} else {
		const row = (label: string, value: string) =>
			console.log(`  ${chalk.dim(label.padEnd(9))} ${value}`);
		const choices = Object.entries(manifest.choices).map(
			([a, o]) => `${a}=${o}`,
		);
		console.log("");
		row("Manifest", project.manifestPath);
		row("Source", describeSource(project.source));
		row("Stacks", summary.stacks.join(" → "));
		row("Choices", choices.join(", ") || "none");
		if (project.unset.length > 0) {
			row("Unset", chalk.yellow(project.unset.join(", ")));
		}
		row("Features", manifest.features.join(", ") || "none");
		row("Applied", String(manifest.applied.length));
		row(
			"Pending",
			project.plan.required.length > 0
				? chalk.yellow(`${project.plan.required.length} required`)
				: chalk.green("none required") +
						(project.plan.optional.length > 0
							? `, ${project.plan.optional.length} optional`
							: ""),
		);
		for (const problem of project.problems) {
			console.log(`  ${chalk.red("problem")}   ${problem}`);
		}
		console.log("");
	}
	if (project.problems.length > 0) process.exitCode = 1;
}

// ── context ──────────────────────────────────────────────────────────────────

interface ContextOptions extends SourceOptions {
	"if-present"?: boolean;
}

/**
 * Prints the rules and skills index for the project. With `--if-present`
 * (meant for agent session hooks) it prints nothing outside a stack project and
 * never fails: a problem becomes a note the agent can relay.
 */
export async function stackContext(options: ContextOptions): Promise<void> {
	const ifPresent = options["if-present"] ?? false;
	const manifestPath = findManifest();
	if (manifestPath === undefined) {
		if (ifPresent) return;
		requireManifest();
		return;
	}
	try {
		const project = await loadProject(options, manifestPath);
		const choices = project.loaded.manifest.choices;
		const rules = await Promise.all(
			selectRules(project.chain, choices, project.loaded.manifest.features).map(
				async (rule) => ({
					label: `${rule.stack}/rules/${rule.file}`,
					content: await readFile(rule.path, "utf8"),
				}),
			),
		);
		process.stdout.write(
			renderContext({
				chain: project.chain,
				manifest: project.loaded.manifest,
				manifestPath: (
					relative(process.cwd(), manifestPath) || manifestPath
				).replaceAll("\\", "/"),
				rules,
				skills: listSkills(project.chain),
				plan: project.plan,
				unset: project.unset,
				problems: project.problems,
			}),
		);
	} catch (error) {
		if (!ifPresent) throw error;
		const message = error instanceof Error ? error.message : String(error);
		console.log(
			`> **Attention:** this project has ${MANIFEST_DISPLAY} but its stack rules could not be loaded: ${message}\n> Tell the user before starting work.`,
		);
	}
}

// ── skill ────────────────────────────────────────────────────────────────────

export async function stackSkill(
	name: string,
	options: SourceOptions,
): Promise<void> {
	const project = await loadProject(options);
	const skills = listSkills(project.chain);
	const skill = skills.find((s) => s.name === name);
	if (skill === undefined) {
		throw new Error(
			`Unknown skill "${name}" (available: ${skills.map((s) => s.name).join(", ") || "none"})`,
		);
	}
	const content = await readFile(join(skill.dir, "SKILL.md"), "utf8");
	process.stdout.write(
		`<!-- Skill folder: ${skill.dir} (paths in this skill are relative to it) -->\n${content}`,
	);
}

// ── plan ─────────────────────────────────────────────────────────────────────

export async function stackPlan(options: CommonOptions): Promise<void> {
	const project = await loadProject(options);
	const { required, optional } = project.plan;
	if (options.json) {
		console.log(
			JSON.stringify(
				{
					required: required.map(migrationSummary),
					optional: optional.map(migrationSummary),
					problems: project.problems,
				},
				null,
				2,
			),
		);
		return;
	}

	const print = (entry: MigrationEntry, index?: number) => {
		const m = migrationSummary(entry);
		const prefix = index === undefined ? "-" : `${index + 1}.`;
		console.log(`  ${prefix} ${chalk.bold(m.id)}  ${m.title}`);
		const details = [
			Object.keys(m.set).length > 0 &&
				`sets ${Object.entries(m.set)
					.map(([a, o]) => `${a}=${o}`)
					.join(", ")}`,
			m.deps.add.length > 0 && `add ${m.deps.add.join(" ")}`,
			m.deps.remove.length > 0 && `remove ${m.deps.remove.join(" ")}`,
			m.verify.length > 0 && `verify: ${m.verify.join(" && ")}`,
			m.steps && `steps: ${m.steps}`,
		].filter(Boolean);
		for (const detail of details)
			console.log(`       ${chalk.dim(String(detail))}`);
	};

	console.log("");
	for (const problem of project.problems) {
		console.log(`  ${chalk.red("problem")}  ${problem}`);
	}
	if (required.length === 0) {
		console.log(`  ${chalk.green("No required migrations pending.")}`);
	} else {
		console.log(chalk.yellow("  Required, in order:"));
		for (const [i, entry] of required.entries()) print(entry, i);
	}
	if (optional.length > 0) {
		console.log(`\n  ${chalk.cyan("Optional:")}`);
		for (const entry of optional) print(entry);
	}
	if (required.length + optional.length > 0) {
		console.log(
			chalk.dim(
				"\n  For each one: `padosoft stack migrate <id>`, follow the steps it prints, then `padosoft stack mark <id>` (runs verify first).",
			),
		);
	}
	console.log("");
}

// ── validate ─────────────────────────────────────────────────────────────────

/**
 * Checks a whole stacks source; meant for its authors and its CI. Migrations
 * that are Codemod packages with a `tests/` folder get their transforms tested.
 */
export async function stackValidate(options: SourceOptions): Promise<void> {
	const source = resolveSource(options, warn);
	const catalog = await loadCatalog(source.root);
	const problems = catalog.issues.map((i) => `${i.path}: ${i.message}`);
	for (const id of catalog.stacks.keys()) {
		try {
			problems.push(...validateChain(resolveChain(catalog, [id])));
		} catch (error) {
			problems.push(
				`${id}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
	for (const stack of catalog.stacks.values()) {
		for (const entry of stack.migrations) {
			if (!isCodemodPackage(entry.dir) || !existsSync(join(entry.dir, "tests")))
				continue;
			for (const problem of await testCodemod(entry.dir))
				problems.push(`${entry.id}: ${problem}`);
		}
	}
	const unique = [...new Set(problems)];
	console.log("");
	for (const stack of catalog.stacks.values()) {
		console.log(
			`  ${chalk.bold(stack.id)}  ${chalk.dim(
				`${Object.keys(stack.definition.axes).length} axes · ${stack.rules.length} rules · ${stack.skills.length} skills · ${stack.migrations.length} migrations`,
			)}`,
		);
	}
	for (const problem of unique)
		console.log(`  ${chalk.red("problem")}  ${problem}`);
	console.log(
		unique.length === 0
			? `\n  ${chalk.green("valid")}\n`
			: `\n  ${chalk.red(`${unique.length} problem(s)`)}\n`,
	);
	if (unique.length > 0) process.exitCode = 1;
}
