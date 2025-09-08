export const supportsTTY: boolean =
	typeof process !== "undefined" &&
	"stdout" in process &&
	"isTTY" in process.stdout &&
	process.stdout.isTTY;

export const isAzurePipeline: boolean =
	typeof process !== "undefined" &&
	"env" in process &&
	"TF_BUILD" in process.env &&
	"AGENT_NAME" in process.env;

export const isCI: boolean =
	typeof process !== "undefined" && "env" in process && "CI" in process.env;

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

	const modernColorterms = new Set(["truecolor", "24bit"]);

	const isModernTermProgram =
		TERM_PROGRAM && modernTermPrograms.has(TERM_PROGRAM);
	const isModernColorterm =
		COLORTERM && modernColorterms.has(COLORTERM.toLowerCase());
	const isKnownModernTerm =
		TERM && /xterm-256color|screen-256color|tmux-256color/.test(TERM);

	return isModernTermProgram || isModernColorterm || isKnownModernTerm || false;
};

export const isWindowsCmd: boolean =
	typeof process !== "undefined" &&
	"platform" in process &&
	process.platform === "win32";

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
