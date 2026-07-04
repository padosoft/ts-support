export const isBrowser: boolean =
	typeof window !== "undefined" && typeof document !== "undefined";

export const isNode: boolean =
	typeof process !== "undefined" && process.versions?.node != null;

export const supportsTTY: boolean =
	typeof process !== "undefined" &&
	"stdout" in process &&
	"isTTY" in process.stdout &&
	process.stdout.isTTY;

export const isCI: boolean =
	typeof process !== "undefined" && "env" in process && "CI" in process.env;

export const isAzurePipeline: boolean =
	typeof process !== "undefined" &&
	"env" in process &&
	"TF_BUILD" in process.env &&
	"AGENT_NAME" in process.env;

export const isWindowsCmd: boolean =
	typeof process !== "undefined" &&
	"platform" in process &&
	process.platform === "win32";

export const isModernTerminal = (): boolean => {
	if (typeof process === "undefined" || !("env" in process)) return false;

	const { TERM_PROGRAM, COLORTERM, TERM } = process.env;

	const modernTermPrograms = new Set([
		"iTerm.app",
		"Apple_Terminal",
		"Hyper",
		"vscode",
		"Windows Terminal",
		"Alacritty",
		"Tabby",
		"WezTerm",
	]);

	const isModernTermProgram =
		TERM_PROGRAM && modernTermPrograms.has(TERM_PROGRAM);
	const isModernColorterm =
		COLORTERM &&
		new Set(["truecolor", "24bit"]).has(COLORTERM.toLowerCase());
	const isKnownModernTerm =
		TERM && /xterm-256color|screen-256color|tmux-256color/.test(TERM);

	return isModernTermProgram || isModernColorterm || isKnownModernTerm || false;
};

export const supportsUnicode = (): boolean => {
	if (!isWindowsCmd) return true;
	return isModernTerminal();
};

export const supportsColors = (): boolean => {
	if (supportsTTY) return true;
	if (isCI) return true;
	if (isAzurePipeline) return true;
	return isModernTerminal();
};

/** True in Node and React Native (ANSI escape codes render); false in browsers. */
export const supportsAnsi = (): boolean => !isBrowser;
