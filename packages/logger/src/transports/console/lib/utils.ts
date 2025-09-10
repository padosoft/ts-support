import type { LogLevel } from "@/lib";
import type { ConsoleMethods } from "@/transports/console/types";

export const consoleMethods: Partial<Record<LogLevel, ConsoleMethods>> = {
	info: "info",
	warn: "warn",
	error: "error",
	debug: "debug",
	success: "log",
} as const;
