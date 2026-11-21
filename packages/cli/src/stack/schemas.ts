import * as z from "zod";

/**
 * Formats shared by the stack commands. The CLI knows only these shapes: what
 * the axes, options, rules and migrations actually are lives in the stacks
 * source (a separate, private repository), never in this package.
 */

/** `<id>`: lowercase letters, digits and hyphens, like an Agent Skills name. */
const Identifier = z
	.string()
	.regex(
		/^[a-z0-9]+(-[a-z0-9]+)*$/,
		"lowercase letters, digits and single hyphens",
	);

const Choices = z.record(Identifier, Identifier);

/** `.padosoft/stack.json` in a project: the project's state, never knowledge. */
export interface StackManifest {
	$schema?: string | undefined;
	stacks: string[];
	choices: Record<string, string>;
	features: string[];
	applied: string[];
}

export const StackManifestSchema: z.ZodType<StackManifest> = z
	.object({
		$schema: z.string().optional(),
		stacks: z.array(Identifier).min(1).describe("Stacks this project uses"),
		choices: Choices.default({}).describe("Selected option for each axis"),
		features: z
			.array(Identifier)
			.default([])
			.describe("Features added to the project"),
		applied: z
			.array(z.string())
			.default([])
			.describe("Migrations already applied, as <stack>/<migration>"),
	})
	.strict();

/** `stacks/<id>/stack.json` in the stacks source. */
export interface AxisDefinition {
	description?: string | undefined;
	options: string[];
	/** When to pick each option, shown when choosing. */
	descriptions: Record<string, string>;
	default?: string | undefined;
}

export interface StackDefinition {
	$schema?: string | undefined;
	description?: string | undefined;
	extends: string[];
	axes: Record<string, AxisDefinition>;
	/** Defaults this stack proposes for axes it inherits. */
	defaults: Record<string, string>;
}

export const StackDefinitionSchema: z.ZodType<StackDefinition> = z
	.object({
		$schema: z.string().optional(),
		description: z.string().optional(),
		extends: z
			.array(Identifier)
			.default([])
			.describe(
				"Stacks whose axes, rules, skills and migrations this one inherits",
			),
		axes: z
			.record(
				Identifier,
				z
					.object({
						description: z.string().optional(),
						options: z.array(Identifier).min(1),
						descriptions: z
							.record(Identifier, z.string())
							.default({})
							.describe("When to pick each option, keyed by option"),
						default: Identifier.optional().describe(
							"Option proposed for new projects; never applied to existing ones",
						),
					})
					.strict()
					.refine(
						(axis) =>
							axis.default === undefined || axis.options.includes(axis.default),
						{ message: "default must be one of options" },
					)
					.refine(
						(axis) =>
							Object.keys(axis.descriptions).every((o) =>
								axis.options.includes(o),
							),
						{ message: "descriptions must only describe listed options" },
					),
			)
			.default({})
			.describe("Decision axes this stack introduces"),
		defaults: Choices.default({}).describe(
			"Defaults for inherited axes; when several stacks of a project set one, the last stack wins",
		),
	})
	.strict();

/** Package changes, as package-manager specs (`name`, `name@1.2.3`, `@scope/name@~1.2`). */
export interface Deps {
	add: string[];
	dev: string[];
	remove: string[];
}

const DepsSchema = z
	.object({
		add: z.array(z.string()).default([]).describe("dependencies"),
		dev: z.array(z.string()).default([]).describe("devDependencies"),
		remove: z.array(z.string()).default([]),
	})
	.strict()
	.default({ add: [], dev: [], remove: [] });

/** `stacks/<id>/migrations/<name>/migration.json` in the stacks source. */
export interface Migration {
	$schema?: string | undefined;
	title: string;
	description?: string | undefined;
	kind: "required" | "optional";
	when: Record<string, string>;
	set: Record<string, string>;
	deps: Deps;
	verify: string[];
}

export const MigrationSchema: z.ZodType<Migration> = z
	.object({
		$schema: z.string().optional(),
		title: z.string().min(1),
		description: z.string().optional(),
		kind: z
			.enum(["required", "optional"])
			.default("required")
			.describe("Optional migrations are offered, never required"),
		when: Choices.default({}).describe(
			"Applies only while every axis has this option",
		),
		set: Choices.default({}).describe("Choices recorded once applied"),
		deps: DepsSchema,
		verify: z
			.array(z.string())
			.default([])
			.describe("Commands that must pass before the migration is marked"),
	})
	.strict();

/**
 * `stacks/<id>/recipes/<name>/recipe.json` in the stacks source. Next to it,
 * `files/` is copied into the project and `steps.md` holds what the agent does
 * by hand. The folder name says what the recipe records: `<axis>.<option>`
 * sets a choice, `feature.<name>` adds a feature, `init` runs on `stack init`.
 */
export interface Recipe {
	$schema?: string | undefined;
	title: string;
	description?: string | undefined;
	deps: Deps;
	/** JSON files deep-merged into the project, by path relative to it. */
	merge: Record<string, Record<string, unknown>>;
}

export const RecipeSchema: z.ZodType<Recipe> = z
	.object({
		$schema: z.string().optional(),
		title: z.string().min(1),
		description: z.string().optional(),
		deps: DepsSchema,
		merge: z
			.record(z.string(), z.record(z.string(), z.unknown()))
			.default({})
			.describe(
				"JSON files deep-merged into the project: objects merge, arrays gain missing items, values are replaced",
			),
	})
	.strict();

/** Frontmatter of an Agent Skills `SKILL.md` (only the fields the CLI reads). */
export const SkillFrontmatterSchema: z.ZodType<{
	name: string;
	description: string;
}> = z.looseObject({
	name: Identifier,
	description: z
		.string()
		.min(1)
		.refine((d) => !/[<>]/.test(d), "must not contain < or >"),
});

/** Formats a zod error as `path: message` lines. */
export const formatZodError = (error: z.ZodError): string =>
	error.issues
		.map((issue) =>
			issue.path.length > 0
				? `${issue.path.join(".")}: ${issue.message}`
				: issue.message,
		)
		.join("; ");
