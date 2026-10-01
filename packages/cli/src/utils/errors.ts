import { chalk } from "@padosoft/utilities/lib/chalk";

/** Prints a red error and exits with code 1. */
export function fail(message: string): never {
	console.error(`\n${chalk.red("error")}  ${message}\n`);
	process.exit(1);
}

/** Wraps a command handler so any thrown error is reported through {@link fail}. */
export const withErrorHandling =
	<A extends unknown[]>(handler: (...args: A) => Promise<void> | void) =>
	async (...args: A): Promise<void> => {
		try {
			await handler(...args);
		} catch (error) {
			fail(error instanceof Error ? error.message : String(error));
		}
	};
