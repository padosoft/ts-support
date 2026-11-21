import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
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
 * stacks/<stack>/rules/<name>.md                    always
 * stacks/<stack>/rules/<axis>/<option>.md           when choices[axis] = option
 * stacks/<stack>/rules/feature/<name>.md            when features contains name
 * stacks/<stack>/skills/<name>/SKILL.md
 * stacks/<stack>/recipes/<name>/recipe.json         (+ files/, steps.md)
 * stacks/<stack>/recipes/<axis>/<option>/recipe.json
 * stacks/<stack>/recipes/feature/<name>/recipe.json
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
	/** Path relative to `rules/`, e.g. `styling/uniwind.md`. */
	file: string;
	path: string;
	condition: Condition;
}

export interface RecipeEntry {
	stack: string;
	/** `init`, `<axis>/<option>` or `feature/<name>`: what `stack apply` takes. */
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

const FEATURE_GROUP = "feature";
const SEGMENT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Reads where a rule (path without `.md`) or a recipe sits: `<name>`
 * always, `<axis>/<option>` for a choice, `feature/<name>` for a feature.
 * Returns an error message for any other shape.
 */
export const parseCondition = (path: string): Condition | string => {
	const parts = path.split("/");
	if (parts.length > 2 || !parts.every((part) => SEGMENT.test(part))) {
		return `expected <name>, <axis>/<option> or ${FEATURE_GROUP}/<name>, in lowercase letters, digits and hyphens`;
	}
	const [group, value] = parts as [string, string | undefined];
	if (value === undefined) return { kind: "always" };
	return group === FEATURE_GROUP
		? { kind: "feature", feature: value }
		: { kind: "choice", axis: group, option: value };
};

const listDirs = async (dir: string): Promise<string[]> =>
	existsSync(dir)
		? (await readdir(dir, { withFileTypes: true }))
				.filter((e) => e.isDirectory())
				.map((e) => e.name)
				.sort()
		: [];

/**
 * `.md` files of `dir` and of its direct subfolders, as `/`-separated
 * relative paths, plus the folders nested deeper than that (never read).
 */
async function listMarkdown(
	dir: string,
): Promise<{ files: string[]; tooDeep: string[] }> {
	const files: string[] = [];
	const tooDeep: string[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		if (entry.isFile() && entry.name.endsWith(".md")) files.push(entry.name);
		if (!entry.isDirectory()) continue;
		const sub = join(dir, entry.name);
		for (const child of await readdir(sub, { withFileTypes: true })) {
			if (child.isFile() && child.name.endsWith(".md")) {
				files.push(`${entry.name}/${child.name}`);
			} else if (child.isDirectory()) {
				tooDeep.push(join(sub, child.name));
			}
		}
	}
	return { files: files.sort(), tooDeep };
}

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
	const listed = existsSync(rulesDir)
		? await listMarkdown(rulesDir)
		: { files: [], tooDeep: [] };
	for (const path of listed.tooDeep) {
		issue(path, "rules nest one level only: rules/<axis>/<option>.md");
	}
	for (const file of listed.files) {
		const path = join(rulesDir, ...file.split("/"));
		const condition = parseCondition(file.slice(0, -".md".length));
		if (typeof condition === "string") issue(path, condition);
		else rules.push({ stack: id, file, path, condition });
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
	// A folder holding recipe.json is a recipe; any other folder groups one
	// recipe per option (`<axis>/<option>/`, `feature/<name>/`).
	const recipeNames: string[] = [];
	for (const top of await listDirs(recipesDir)) {
		if (existsSync(join(recipesDir, top, "recipe.json"))) {
			recipeNames.push(top);
			continue;
		}
		const options = await listDirs(join(recipesDir, top));
		if (options.length === 0)
			issue(join(recipesDir, top), "missing recipe.json");
		recipeNames.push(...options.map((option) => `${top}/${option}`));
	}
	for (const name of recipeNames) {
		const recipeDir = join(recipesDir, ...name.split("/"));
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
