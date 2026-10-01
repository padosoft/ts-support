import { createInterface } from "node:readline/promises";
import { chalk } from "@padosoft/utilities/lib/chalk";

export interface Choice {
	value: string;
	label?: string;
	hint?: string;
}

export const isInteractive = (): boolean =>
	Boolean(process.stdin.isTTY && process.stdout.isTTY) &&
	!("CI" in process.env);

const ask = async (question: string): Promise<string> => {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		return (await rl.question(question)).trim();
	} finally {
		rl.close();
	}
};

/**
 * Numbered single-choice prompt. Enter picks the first choice (the default).
 * An answer that is neither a listed number nor a listed value is re-asked.
 */
export const select = async (
	message: string,
	choices: Choice[],
): Promise<string> => {
	console.log(`\n${chalk.cyan("?")} ${message}`);
	choices.forEach((choice, i) => {
		const label = choice.label ?? choice.value;
		const hint = choice.hint ? `  ${chalk.dim(choice.hint)}` : "";
		console.log(`  ${chalk.dim(`${i + 1})`)} ${label}${hint}`);
	});

	while (true) {
		const answer = await ask(
			`${chalk.dim(`Choice [1-${choices.length}, default 1]:`)} `,
		);
		if (!answer) return (choices[0] as Choice).value;

		const byIndex = choices[Number(answer) - 1];
		if (/^\d+$/.test(answer) && byIndex) return byIndex.value;

		const byValue = choices.find((c) => c.value === answer);
		if (byValue) return byValue.value;

		console.log(
			`  ${chalk.red("invalid")}  pick a number between 1 and ${choices.length}`,
		);
	}
};

/** Free-text prompt; re-asks until a non-empty answer is given. */
export const input = async (message: string): Promise<string> => {
	while (true) {
		const answer = await ask(`${chalk.cyan("?")} ${message} `);
		if (answer) return answer;
	}
};
