import type {
	Catalog,
	Condition,
	MigrationEntry,
	RecipeEntry,
	RuleEntry,
	SkillEntry,
	StackEntry,
} from "./catalog";
import type { AxisDefinition } from "./schemas";

/**
 * Pure resolution over a loaded {@link Catalog}: which stacks a project
 * inherits, which axes and options exist, which rules and skills apply to its
 * choices, and which migrations are pending.
 */

export interface AxisEntry extends AxisDefinition {
	stack: string;
}

export interface Chain {
	/** Stacks in inheritance order: every stack comes after the ones it extends. */
	stacks: StackEntry[];
	axes: Map<string, AxisEntry>;
}

/** Resolves stacks and everything they extend, bases first. Throws on unknown stacks and cycles. */
export function resolveChain(catalog: Catalog, stackIds: string[]): Chain {
	const ordered: StackEntry[] = [];
	const done = new Set<string>();
	const visiting: string[] = [];

	const visit = (id: string, from?: string): void => {
		if (done.has(id)) return;
		if (visiting.includes(id)) {
			throw new Error(
				`Stack inheritance cycle: ${[...visiting, id].join(" → ")}`,
			);
		}
		const entry = catalog.stacks.get(id);
		if (entry === undefined) {
			throw new Error(
				from === undefined
					? `Unknown stack "${id}" (available: ${[...catalog.stacks.keys()].join(", ") || "none"})`
					: `Stack "${from}" extends unknown stack "${id}"`,
			);
		}
		visiting.push(id);
		for (const base of entry.definition.extends) visit(base, id);
		visiting.pop();
		done.add(id);
		ordered.push(entry);
	};
	for (const id of stackIds) visit(id);

	const axes = new Map<string, AxisEntry>();
	for (const stack of ordered) {
		for (const [name, axis] of Object.entries(stack.definition.axes)) {
			const existing = axes.get(name);
			if (existing !== undefined) {
				throw new Error(
					`Axis "${name}" is declared by both "${existing.stack}" and "${stack.id}"`,
				);
			}
			axes.set(name, { ...axis, stack: stack.id });
		}
	}
	// Stack defaults override inherited ones, later stacks last (so they win).
	// Invalid overrides are skipped here and reported by validateChain.
	for (const stack of ordered) {
		for (const [name, option] of Object.entries(stack.definition.defaults)) {
			const axis = axes.get(name);
			if (axis?.options.includes(option))
				axes.set(name, { ...axis, default: option });
		}
	}
	return { stacks: ordered, axes };
}

const describeChoice = (
	axes: Map<string, AxisEntry>,
	axis: string,
	option: string,
): string | undefined => {
	const entry = axes.get(axis);
	if (entry === undefined) return `unknown axis "${axis}"`;
	if (!entry.options.includes(option)) {
		return `"${option}" is not an option of "${axis}" (${entry.options.join(", ")})`;
	}
	return undefined;
};

/** Checks that the rules, recipes, migrations and skills of a chain only refer to axes and options it declares. */
export function validateChain(chain: Chain): string[] {
	const problems: string[] = [];
	const checkCondition = (path: string, condition: Condition) => {
		if (condition.kind !== "choice") return;
		const problem = describeChoice(
			chain.axes,
			condition.axis,
			condition.option,
		);
		if (problem !== undefined) problems.push(`${path}: ${problem}`);
	};
	const checkUnique = (
		owners: Map<string, string>,
		kind: string,
		name: string,
		stack: string,
		path: string,
	) => {
		const owner = owners.get(name);
		if (owner !== undefined) {
			problems.push(`${path}: ${kind} "${name}" is also defined by "${owner}"`);
		}
		owners.set(name, stack);
	};
	const skillOwners = new Map<string, string>();
	const recipeOwners = new Map<string, string>();
	for (const stack of chain.stacks) {
		for (const [axis, option] of Object.entries(stack.definition.defaults)) {
			const problem = describeChoice(chain.axes, axis, option);
			if (problem !== undefined) {
				problems.push(`${stack.dir}/stack.json: defaults: ${problem}`);
			}
		}
		for (const rule of stack.rules) checkCondition(rule.path, rule.condition);
		for (const recipe of stack.recipes) {
			checkCondition(recipe.dir, recipe.target);
			// `init` is per stack: each stack of the chain may have its own.
			if (recipe.name !== INIT_RECIPE) {
				checkUnique(recipeOwners, "recipe", recipe.name, stack.id, recipe.dir);
			}
		}
		for (const entry of stack.migrations) {
			for (const field of ["when", "set"] as const) {
				for (const [axis, option] of Object.entries(entry.migration[field])) {
					const problem = describeChoice(chain.axes, axis, option);
					if (problem !== undefined) {
						problems.push(`${entry.dir}/migration.json: ${field}: ${problem}`);
					}
				}
			}
		}
		for (const skill of stack.skills) {
			checkUnique(skillOwners, "skill", skill.name, stack.id, skill.dir);
		}
	}
	return problems;
}

export interface ChoicesCheck {
	/** Choices naming an unknown axis or option. */
	problems: string[];
	/**
	 * Axes of the chain the project has not recorded. An axis `default` is
	 * deliberately never applied here: it only seeds new projects, so changing a
	 * stack's default never changes what existing projects get.
	 */
	unset: string[];
}

/** Checks a project's choices against the axes of its chain. */
export function checkChoices(
	chain: Chain,
	choices: Record<string, string>,
): ChoicesCheck {
	const problems: string[] = [];
	for (const [axis, option] of Object.entries(choices)) {
		const problem = describeChoice(chain.axes, axis, option);
		if (problem !== undefined) problems.push(`choices.${axis}: ${problem}`);
	}
	const unset = [...chain.axes.keys()].filter((axis) => !(axis in choices));
	return { problems, unset };
}

/** Recipe every stack may have, applied by `stack init` bases first. */
export const INIT_RECIPE = "init";

/** Whether a rule or recipe condition holds for these choices and features. */
export function conditionHolds(
	condition: Condition,
	choices: Record<string, string>,
	features: string[],
): boolean {
	switch (condition.kind) {
		case "always":
			return true;
		case "choice":
			return choices[condition.axis] === condition.option;
		case "feature":
			return features.includes(condition.feature);
	}
}

/** Rules that apply to the choices and features, bases first, then file name order. */
export const selectRules = (
	chain: Chain,
	choices: Record<string, string>,
	features: string[],
): RuleEntry[] =>
	chain.stacks.flatMap((stack) =>
		stack.rules.filter((rule) =>
			conditionHolds(rule.condition, choices, features),
		),
	);

export const listSkills = (chain: Chain): SkillEntry[] =>
	chain.stacks.flatMap((stack) => stack.skills);

export const listRecipes = (chain: Chain): RecipeEntry[] =>
	chain.stacks.flatMap((stack) => stack.recipes);

/** A recipe by name; `init` is ambiguous across stacks, so it is looked up per stack instead. */
export const findRecipe = (
	chain: Chain,
	name: string,
): RecipeEntry | undefined =>
	listRecipes(chain).find((r) => r.name === name && r.name !== INIT_RECIPE);

export interface MigrationPlan {
	/** Required migrations to run, in order. */
	required: MigrationEntry[];
	/** Optional migrations that apply to the current choices. */
	optional: MigrationEntry[];
	/** `applied` ids that no stack of the chain defines (renamed or removed). */
	unknownApplied: string[];
}

const matches = (
	when: Record<string, string>,
	choices: Record<string, string>,
): boolean =>
	Object.entries(when).every(([axis, option]) => choices[axis] === option);

/**
 * Pending migrations, ordered by name (so a date prefix orders them) and then
 * by stack order. Each required migration's `set` is applied before the next
 * `when` is evaluated, the same as running them one after the other.
 */
export function planMigrations(
	chain: Chain,
	choices: Record<string, string>,
	applied: string[],
): MigrationPlan {
	const order = new Map(chain.stacks.map((s, i) => [s.id, i]));
	const all = chain.stacks
		.flatMap((s) => s.migrations)
		.sort(
			(a, b) =>
				a.name.localeCompare(b.name) ||
				(order.get(a.stack) ?? 0) - (order.get(b.stack) ?? 0),
		);
	const done = new Set(applied);
	const current = { ...choices };
	const required: MigrationEntry[] = [];
	const optional: MigrationEntry[] = [];
	for (const entry of all) {
		if (done.has(entry.id) || !matches(entry.migration.when, current)) continue;
		if (entry.migration.kind === "optional") {
			optional.push(entry);
			continue;
		}
		required.push(entry);
		Object.assign(current, entry.migration.set);
	}
	const known = new Set(all.map((e) => e.id));
	return {
		required,
		optional,
		unknownApplied: applied.filter((id) => !known.has(id)),
	};
}
