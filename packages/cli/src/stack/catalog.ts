import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { parse as parseYaml } from "yaml";
import {
	formatZodError,
	type Migration,
	MigrationSchema,
	type Recipe,
	RecipeSchema,
	SkillFrontmatterSchema,
	type StackDefinition,
	StackDefinitionSchema,
} from "./schemas";

/**
 * Reads a stacks source:
 *
 * ```
 * stacks/<stack>/stack.json
 * stacks/<stack>/rules/<name>.md                 always
 * stacks/<stack>/rules/<axis>.<option>.md        when choices[axis] = option
 * stacks/<stack>/rules/feature.<name>.md         when features contains name
 * stacks/<stack>/skills/<name>/SKILL.md
 * stacks/<stack>/recipes/<name>/recipe.json      (+ files/, steps.md)
 * stacks/<stack>/migrations/<name>/migration.json (+ codemod.{mjs,js,ts}, steps.md)
 * ```
 *
 * Rule files and recipe folders share one naming scheme, see {@link parseCondition}.
 *
 * Problems are collected as {@link CatalogIssue}s rather than thrown, so one
 * broken file does not hide the rest of the report.
 */

export type Condition =
	| { kind: "always" }
	| { kind: "choice"; axis: string; option: string }
	| { kind: "feature"; feature: string };

export interface RuleEntry {
	stack: string;
	/** File name, e.g. `styling.uniwind.md`. */
	file: string;
	path: string;
	condition: Condition;
}

export interface RecipeEntry {
	stack: string;
	name: string;
	dir: string;
	/** What applying it records: a choice, a feature, or nothing. */
	target: Condition;
	recipe: Recipe;
}

export interface SkillEntry {
	stack: string;
	name: string;
	description: string;
	dir: string;
}

export interface MigrationEntry {
	/** `<stack>/<name>`: the value recorded in the manifest's `applied`. */
	id: string;
	stack: string;
	name: string;
	dir: string;
	migration: Migration;
}

export interface StackEntry {
	id: string;
	dir: string;
	definition: StackDefinition;
	rules: RuleEntry[];
	skills: SkillEntry[];
	recipes: RecipeEntry[];
	migrations: MigrationEntry[];
}

export interface CatalogIssue {
	stack: string;
	path: string;
	message: string;
}

export interface Catalog {
	root: string;
	stacks: Map<string, StackEntry>;
	issues: CatalogIssue[];
}

const FEATURE_PREFIX = "feature";

/**
 * Reads a rule file name (without `.md`) or a recipe folder name:
 * `<name>` always, `<axis>.<option>` for a choice, `feature.<name>` for a
 * feature. Returns an error message for any other shape.
 */
export const parseCondition = (name: string): Condition | string => {
	const parts = name.split(".");
	if (parts.length === 1) return { kind: "always" };
	if (parts.length !== 2 || parts.some((p) => p.length === 0)) {
		return `expected <name>, <axis>.<option> or ${FEATURE_PREFIX}.<name>`;
	}
	const [prefix, value] = parts as [string, string];
	return prefix === FEATURE_PREFIX
		? { kind: "feature", feature: value }
		: { kind: "choice", axis: prefix, option: value };
};

const listDirs = async (dir: string): Promise<string[]> =>
	existsSync(dir)
		? (await readdir(dir, { withFileTypes: true }))
				.filter((e) => e.isDirectory())
				.map((e) => e.name)
				.sort()
		: [];

const readJson = async (path: string): Promise<unknown> =>
	JSON.parse(await readFile(path, "utf8"));

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** Splits a markdown file into its YAML frontmatter and body. */
export const splitFrontmatter = (
	markdown: string,
): { frontmatter: unknown; body: string } => {
	const match = FRONTMATTER.exec(markdown);
	if (match === null) return { frontmatter: undefined, body: markdown };
	return {
		frontmatter: parseYaml(match[1] ?? ""),
		body: markdown.slice(match[0].length),
	};
};

async function loadStack(
	id: string,
	dir: string,
	issues: CatalogIssue[],
): Promise<StackEntry | undefined> {
	const issue = (path: string, message: string) =>
		issues.push({ stack: id, path, message });

	const definitionPath = join(dir, "stack.json");
	if (!existsSync(definitionPath)) {
		issue(definitionPath, "missing stack.json");
		return undefined;
	}
	let definition: StackDefinition;
	try {
		const parsed = StackDefinitionSchema.safeParse(
			await readJson(definitionPath),
		);
		if (!parsed.success) {
			issue(definitionPath, formatZodError(parsed.error));
			return undefined;
		}
		definition = parsed.data;
	} catch (error) {
		issue(definitionPath, String(error));
		return undefined;
	}

	const rules: RuleEntry[] = [];
	const rulesDir = join(dir, "rules");
	if (existsSync(rulesDir)) {
		const files = (await readdir(rulesDir, { withFileTypes: true }))
			.filter((e) => e.isFile() && e.name.endsWith(".md"))
			.map((e) => e.name)
			.sort();
		for (const file of files) {
			const path = join(rulesDir, file);
			const condition = parseCondition(basename(file, ".md"));
			if (typeof condition === "string") issue(path, condition);
			else rules.push({ stack: id, file, path, condition });
		}
	}

	const skills: SkillEntry[] = [];
	const skillsDir = join(dir, "skills");
	for (const name of await listDirs(skillsDir)) {
		const skillDir = join(skillsDir, name);
		const path = join(skillDir, "SKILL.md");
		if (!existsSync(path)) {
			issue(path, "missing SKILL.md");
			continue;
		}
		try {
			const { frontmatter } = splitFrontmatter(await readFile(path, "utf8"));
			const parsed = SkillFrontmatterSchema.safeParse(frontmatter);
			if (!parsed.success) {
				issue(path, `frontmatter: ${formatZodError(parsed.error)}`);
				continue;
			}
			if (parsed.data.name !== name) {
				issue(
					path,
					`name "${parsed.data.name}" must match its folder "${name}"`,
				);
				continue;
			}
			skills.push({
				stack: id,
				name,
				description: parsed.data.description.replace(/\s+/g, " ").trim(),
				dir: skillDir,
			});
		} catch (error) {
			issue(path, String(error));
		}
	}

	const recipes: RecipeEntry[] = [];
	const recipesDir = join(dir, "recipes");
	for (const name of await listDirs(recipesDir)) {
		const recipeDir = join(recipesDir, name);
		const path = join(recipeDir, "recipe.json");
		const target = parseCondition(name);
		if (typeof target === "string") {
			issue(recipeDir, target);
			continue;
		}
		if (!existsSync(path)) {
			issue(path, "missing recipe.json");
			continue;
		}
		try {
			const parsed = RecipeSchema.safeParse(await readJson(path));
			if (!parsed.success) {
				issue(path, formatZodError(parsed.error));
				continue;
			}
			recipes.push({
				stack: id,
				name,
				dir: recipeDir,
				target,
				recipe: parsed.data,
			});
		} catch (error) {
			issue(path, String(error));
		}
	}

	const migrations: MigrationEntry[] = [];
	const migrationsDir = join(dir, "migrations");
	for (const name of await listDirs(migrationsDir)) {
		const migrationDir = join(migrationsDir, name);
		const path = join(migrationDir, "migration.json");
		if (!existsSync(path)) {
			issue(path, "missing migration.json");
			continue;
		}
		try {
			const parsed = MigrationSchema.safeParse(await readJson(path));
			if (!parsed.success) {
				issue(path, formatZodError(parsed.error));
				continue;
			}
			migrations.push({
				id: `${id}/${name}`,
				stack: id,
				name,
				dir: migrationDir,
				migration: parsed.data,
			});
		} catch (error) {
			issue(path, String(error));
		}
	}

	return { id, dir, definition, rules, skills, recipes, migrations };
}

/** Loads every stack under `<root>/stacks`. */
export async function loadCatalog(root: string): Promise<Catalog> {
	const stacksDir = join(root, "stacks");
	if (!existsSync(stacksDir)) {
		throw new Error(`Not a stacks source (no stacks/ folder): ${root}`);
	}
	const issues: CatalogIssue[] = [];
	const stacks = new Map<string, StackEntry>();
	for (const id of await listDirs(stacksDir)) {
		const entry = await loadStack(id, join(stacksDir, id), issues);
		if (entry !== undefined) stacks.set(id, entry);
	}
	return { root, stacks, issues };
}
