import { chalk } from "@padosoft/utilities/lib/chalk";
import { supportsColors } from "@padosoft/utilities/lib/runtime";
import type { LogLevel } from "@/lib/levels";

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

export const CSS_COLORS: Record<LogLevel, string> = {
	error: "color: #e74c3c; font-weight: bold",
	fatal: "color: #e74c3c; font-weight: bold",
	warn: "color: #f39c12; font-weight: bold",
	success: "color: #27ae60",
	info: "color: #3498db",
	debug: "color: #9b59b6",
	trace: "color: #808080",
};
