import type { LogLevel } from "@/lib/levels";
import { supportsUnicode } from "@/lib/utils";

export type Symbols = Partial<Record<LogLevel | (string & {}), string>>;

export const symbols = {
	success: "✔",
	error: "✖",
	warn: "⚠",
	info: "i",
	arrow: "➜",
} as const;

export const SUPPORTS_SYMBOLS: boolean = supportsUnicode();

export const symbolize = (level: LogLevel): string => {
	if (!SUPPORTS_SYMBOLS) return "";

	if (level in symbols) {
		return symbols[level as keyof typeof symbols];
	}

	return "";
};
