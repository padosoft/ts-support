import { chalk } from "@padosoft/utilities/lib/chalk";
import type { LogLevel } from "@/lib/levels";
import { supportsColors } from "@/lib/utils";

export const SUPPORTS_COLORS: boolean = supportsColors();

export const getLevelColor = (level: LogLevel): ColorFn =>
	colorMap[level] ?? colors.gray;

export const colors = {
	gray: (s: string): string => chalk.dim(s),
	red: (s: string): string => chalk.red(s),
	green: (s: string): string => chalk.green(s),
	yellow: (s: string): string => chalk.yellow(s),
	blue: (s: string): string => chalk.blue(s),
	purple: (s: string): string => chalk.magenta(s),
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
