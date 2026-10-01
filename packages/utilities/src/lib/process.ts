/**
 * Node-only child process helpers. Not re-exported from the `lib` barrel:
 * import from `@padosoft/utilities/lib/process`.
 */
import {
	type ChildProcess,
	type SpawnOptions,
	type SpawnSyncOptions,
	type SpawnSyncReturns,
	spawn,
	spawnSync,
} from "node:child_process";

export type RunOptions = Omit<SpawnSyncOptions, "encoding" | "stdio">;

export interface RunResult {
	status: number | null;
	stdout: string;
	stderr: string;
	error?: Error;
}

/**
 * `shell` value for commands that are `.cmd` shims on Windows (npm, eas, bunx…),
 * which `spawn` can only resolve through a shell.
 */
export const WINDOWS_SHELL: boolean = process.platform === "win32";

/** Characters with no special meaning in sh or cmd.exe. */
const SHELL_SAFE_ARG = /^[\w@/\\.:,=~+-]+$/;

/**
 * Joins a command and its args into one shell command line. Node does not
 * escape args when `shell` is set (DEP0190), so every arg must be made of
 * shell-inert characters; throws otherwise.
 */
export const toShellCommand = (command: string, args: string[]): string => {
	const unsafe = [command, ...args].find((arg) => !SHELL_SAFE_ARG.test(arg));
	if (unsafe !== undefined) {
		throw new Error(
			`Refusing to pass ${JSON.stringify(unsafe)} through a shell`,
		);
	}
	return [command, ...args].join(" ");
};

const spawnSyncUtf8 = (
	command: string,
	args: string[],
	options: RunOptions,
): SpawnSyncReturns<string> =>
	options.shell
		? spawnSync(toShellCommand(command, args), { ...options, encoding: "utf8" })
		: spawnSync(command, args, { ...options, encoding: "utf8" });

/** `spawn`, routing through {@link toShellCommand} when `options.shell` is set. */
export const spawnProcess = (
	command: string,
	args: string[],
	options: SpawnOptions = {},
): ChildProcess =>
	options.shell
		? spawn(toShellCommand(command, args), options)
		: spawn(command, args, options);

/** Runs a command synchronously and captures its output. Never throws. */
export const run = (
	command: string,
	args: string[],
	options: RunOptions = {},
): RunResult => {
	let result: SpawnSyncReturns<string>;
	try {
		result = spawnSyncUtf8(command, args, options);
	} catch (error) {
		return {
			status: null,
			stdout: "",
			stderr: "",
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
	return {
		status: result.status,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
		...(result.error ? { error: result.error } : {}),
	};
};

/** Runs a command synchronously and returns its stdout; throws on spawn failure or non-zero exit. */
export const runOrThrow = (
	command: string,
	args: string[],
	options: RunOptions = {},
): string => {
	const result = run(command, args, options);
	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(
			`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
		);
	}
	return result.stdout;
};

/** Runs a command with inherited stdio; resolves on exit code 0, rejects otherwise. */
export const runCommand = (
	command: string,
	args: string[],
	options: Omit<SpawnOptions, "stdio"> = {},
): Promise<void> =>
	new Promise((resolve, reject) => {
		const child = spawnProcess(command, args, { ...options, stdio: "inherit" });
		child.on("close", (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(
				new Error(
					`${command} ${args.join(" ")} exited with code ${String(code)}`,
				),
			);
		});
		child.on("error", reject);
	});
