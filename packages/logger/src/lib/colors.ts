import type { LogLevel } from "./levels";
import { supportsColors } from "./utils";

export const SUPPORTS_COLORS: boolean = supportsColors();

export const colorize = (code: number, str: string): string =>
	SUPPORTS_COLORS ? `\x1b[${code}m${str}\x1b[0m` : str;

export const getLevelColor = (level: LogLevel): ColorFn =>
	colorMap[level] ?? colors.gray;

export const colors = {
	gray: (s: string): string => colorize(90, s),
	red: (s: string): string => colorize(31, s),
	green: (s: string): string => colorize(32, s),
	yellow: (s: string): string => colorize(33, s),
	blue: (s: string): string => colorize(34, s),
	purple: (s: string): string => colorize(34, s),
} as const;

export type Colors = typeof colors;
export type Color = keyof Colors;
export type ColorFn = Colors[Color];

export const colorMap: Partial<Record<LogLevel, ColorFn>> = {
	error: colors.red,
	warn: colors.yellow,
	success: colors.green,
	debug: colors.purple,
	fatal: colors.red,
	info: colors.blue,
	trace: colors.gray,
} as const;
