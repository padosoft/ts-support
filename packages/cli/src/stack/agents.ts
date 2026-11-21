import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { detectIndent } from "@padosoft/utilities/lib/json-file";

/**
 * Wires `padosoft stack context` into coding agents, once per machine, in
 * their user-level configuration: never in a project. Claude Code gets a
 * SessionStart hook (its output lands in the session); agents without such a
 * hook get one instruction in their global instructions file.
 */

export type AgentId = "claude" | "codex" | "gemini";

export const AGENT_IDS: AgentId[] = ["claude", "codex", "gemini"];

interface AgentTarget {
	/** The agent's user configuration folder: its presence means it is installed. */
	home: string;
	file: string;
	kind: "hook" | "instructions";
}

export function agentTargets(
	home: string,
	env: NodeJS.ProcessEnv = process.env,
): Record<AgentId, AgentTarget> {
	const claude = env["CLAUDE_CONFIG_DIR"] ?? join(home, ".claude");
	const codex = env["CODEX_HOME"] ?? join(home, ".codex");
	const gemini = join(home, ".gemini");
	return {
		claude: { home: claude, file: join(claude, "settings.json"), kind: "hook" },
		codex: {
			home: codex,
			file: join(codex, "AGENTS.md"),
			kind: "instructions",
		},
		gemini: {
			home: gemini,
			file: join(gemini, "GEMINI.md"),
			kind: "instructions",
		},
	};
}

/** The command agents run; `--source` is baked in when given, so no env var is needed. */
export const contextCommand = (source?: string): string => {
	const base = "padosoft stack context --if-present";
	if (source === undefined) return base;
	return `${base} --source ${/\s/.test(source) ? `"${source}"` : source}`;
};

const MARKER = "padosoft stack context";

interface HookCommand {
	type?: string;
	command?: string;
	[key: string]: unknown;
}

interface HookGroup {
	matcher?: string;
	hooks?: HookCommand[];
	[key: string]: unknown;
}

/**
 * Claude Code settings with exactly one SessionStart hook running `command`.
 * Earlier `padosoft stack context` hooks are replaced (so a new `--source`
 * takes over); every other setting and hook is kept.
 */
export function withClaudeHook(
	settings: Record<string, unknown>,
	command: string,
): Record<string, unknown> {
	const hooks =
		typeof settings["hooks"] === "object" && settings["hooks"] !== null
			? (settings["hooks"] as Record<string, unknown>)
			: {};
	const groups = Array.isArray(hooks["SessionStart"])
		? (hooks["SessionStart"] as HookGroup[])
		: [];
	const kept = groups
		.map((group) => ({
			...group,
			hooks: (group.hooks ?? []).filter(
				(hook) => !String(hook.command ?? "").includes(MARKER),
			),
		}))
		.filter((group) => group.hooks.length > 0);
	return {
		...settings,
		hooks: {
			...hooks,
			SessionStart: [...kept, { hooks: [{ type: "command", command }] }],
		},
	};
}

const BLOCK_START = "<!-- padosoft:stack -->";
const BLOCK_END = "<!-- /padosoft:stack -->";

export const instructionBlock = (command: string): string =>
	[
		BLOCK_START,
		"## Padosoft stacks",
		"",
		`If the repository has \`.padosoft/stack.json\`, run \`${command}\` before starting work and follow what it prints: the project's rules, the skills to load with \`padosoft stack skill <name>\` when a task matches one, and any pending migrations to tell the user about.`,
		BLOCK_END,
	].join("\n");

/** Replaces the marked block in `text`, or appends it. */
export function upsertBlock(text: string, block: string): string {
	const start = text.indexOf(BLOCK_START);
	const end = text.indexOf(BLOCK_END);
	if (start !== -1 && end > start) {
		return text.slice(0, start) + block + text.slice(end + BLOCK_END.length);
	}
	const separator =
		text.length === 0 ? "" : text.endsWith("\n") ? "\n" : "\n\n";
	return `${text}${separator}${block}\n`;
}

export interface SetupResult {
	agent: AgentId;
	file: string;
	status: "written" | "unchanged" | "would write";
}

/** Writes the hook or instruction for each agent; returns what changed. */
export async function setupAgents(
	agents: AgentId[],
	command: string,
	targets: Record<AgentId, AgentTarget>,
	dryRun: boolean,
): Promise<SetupResult[]> {
	const results: SetupResult[] = [];
	for (const agent of agents) {
		const target = targets[agent];
		const current = existsSync(target.file)
			? await readFile(target.file, "utf8")
			: "";
		let next: string;
		if (target.kind === "hook") {
			const settings =
				current.trim() === ""
					? {}
					: (JSON.parse(current) as Record<string, unknown>);
			const updated = withClaudeHook(settings, command);
			next =
				current !== "" && JSON.stringify(updated) === JSON.stringify(settings)
					? current
					: `${JSON.stringify(updated, null, current === "" ? 2 : detectIndent(current))}\n`;
		} else {
			next = upsertBlock(current, instructionBlock(command));
		}
		if (next === current) {
			results.push({ agent, file: target.file, status: "unchanged" });
			continue;
		}
		if (dryRun) {
			results.push({ agent, file: target.file, status: "would write" });
			continue;
		}
		await mkdir(dirname(target.file), { recursive: true });
		await writeFile(target.file, next, "utf8");
		results.push({ agent, file: target.file, status: "written" });
	}
	return results;
}
