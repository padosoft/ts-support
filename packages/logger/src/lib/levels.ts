export const LogLevels = {
	TRACE: "trace",
	DEBUG: "debug",
	INFO: "info",
	SUCCESS: "success",
	WARN: "warn",
	ERROR: "error",
	FATAL: "fatal",
} as const;

export const LogLevelsValues: Record<LogLevel, number> = {
	trace: 10,
	debug: 20,
	info: 30,
	success: 35,
	warn: 40,
	error: 50,
	fatal: 60,
} as const;

export type LogLevel = (typeof LogLevels)[keyof typeof LogLevels];
