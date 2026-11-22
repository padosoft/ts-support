import type { SkillEntry } from "./catalog";
import type { Chain, MigrationPlan } from "./resolve";
import type { StackManifest } from "./schemas";

export interface ContextInput {
	chain: Chain;
	manifest: StackManifest;
	manifestPath: string;
	rules: { label: string; content: string }[];
	skills: SkillEntry[];
	plan: MigrationPlan;
	unset: string[];
	problems: string[];
}

const list = (values: string[]): string =>
	values.length > 0 ? values.join(", ") : "none";

/** The markdown an agent receives at the start of a session in a stack project. */
export function renderContext(input: ContextInput): string {
	const { chain, manifest, plan } = input;
	const choices = Object.entries(manifest.choices).map(
		([axis, option]) => `${axis}=${option}`,
	);
	const out: string[] = [
		"# Project stack",
		"",
		`This project follows the stack below, recorded in \`${input.manifestPath}\`. Its rules apply to every change in the project.`,
		"",
		`- Stacks: ${chain.stacks.map((s) => s.id).join(" → ")}`,
		`- Choices: ${list(choices)}`,
		`- Features: ${list(manifest.features)}`,
	];

	const notes: string[] = [];
	if (plan.required.length > 0) {
		notes.push(
			`${plan.required.length} required migration(s) pending (\`padosoft stack plan\`). Tell the user before starting other work.`,
		);
	}
	if (input.unset.length > 0) {
		notes.push(
			`No option recorded for: ${input.unset.join(", ")}. Do not assume one; ask the user, then record it in choices.`,
		);
	}
	for (const problem of input.problems) notes.push(problem);
	if (notes.length > 0) {
		out.push("", ...notes.map((note) => `> **Attention:** ${note}`));
	}

	out.push("", "## Rules", "");
	if (input.rules.length === 0) out.push("No rules for these choices.");
	for (const rule of input.rules) {
		out.push(`<!-- ${rule.label} -->`, rule.content.trim(), "");
	}

	out.push(
		"",
		"## Skills",
		"",
		"When a task matches a description below, load that skill first with `padosoft stack skill <name>` and follow it.",
		"",
	);
	if (input.skills.length === 0) out.push("No skills.");
	for (const skill of input.skills) {
		out.push(`- \`${skill.name}\`: ${skill.description}`);
	}
	return `${out.join("\n").trimEnd()}\n`;
}
