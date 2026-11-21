import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { chalk } from "@padosoft/utilities/lib/chalk";
import {
	AGENT_IDS,
	type AgentId,
	agentTargets,
	contextCommand,
	setupAgents,
} from "../stack/agents";

const toAgentId = (value: string): AgentId | undefined =>
	AGENT_IDS.find((id) => id === value);

interface AgentsSetupOptions {
	agents?: string;
	source?: string;
	"dry-run"?: boolean;
}

/**
 * Makes every coding agent on this machine load the stack context of the
 * project it opens. Without `--agents`, sets up the agents whose configuration
 * folder exists.
 */
export async function agentsSetup(options: AgentsSetupOptions): Promise<void> {
	const targets = agentTargets(homedir());
	const requested = options.agents
		?.split(",")
		.map((a) => a.trim())
		.filter(Boolean);
	const unknown = requested?.filter((a) => toAgentId(a) === undefined);
	if (unknown !== undefined && unknown.length > 0) {
		throw new Error(
			`Unknown agent(s): ${unknown.join(", ")} (supported: ${AGENT_IDS.join(", ")})`,
		);
	}
	const agents =
		requested?.flatMap((a) => toAgentId(a) ?? []) ??
		AGENT_IDS.filter((id) => existsSync(targets[id].home));
	if (agents.length === 0) {
		throw new Error(
			`No agent configuration found; pass --agents ${AGENT_IDS.join(",")} to create it.`,
		);
	}

	const command = contextCommand(options.source);
	const results = await setupAgents(
		agents,
		command,
		targets,
		options["dry-run"] ?? false,
	);
	console.log(`\n  ${chalk.dim("command")}  ${command}\n`);
	for (const { agent, file, status } of results) {
		const color = status === "unchanged" ? chalk.dim : chalk.green;
		console.log(`  ${color(status.padEnd(11))} ${agent.padEnd(7)} ${file}`);
	}
	console.log(
		chalk.dim(
			"\n  `padosoft` must be on the PATH of every agent: install it globally (bun add -g @padosoft/cli).\n",
		),
	);
}
