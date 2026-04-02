import type * as z from "zod/v4/core";

export type DeepPartial<T> = T extends object
	? {
			[P in keyof T]?: DeepPartial<T[P]>;
		}
	: T;

export type FullPartial<T> = T extends object
	? {
			[P in keyof T]?: T[P] | undefined;
		}
	: T;

export type ConvertMaybeZod<T> = T extends z.$ZodType ? z.infer<T> : T;
export type DeepConvertMaybeZod<T> = T extends z.$ZodType
	? z.infer<T>
	: T extends Array<infer U>
		? DeepConvertMaybeZod<U>[]
		: T extends ReadonlyArray<infer U>
			? Readonly<DeepConvertMaybeZod<U>>[]
			: T extends object
				? { [K in keyof T]: DeepConvertMaybeZod<T[K]> }
				: T;

export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

export type Intersect<T> = (T extends unknown ? (x: T) => 0 : never) extends (
	x: infer R,
) => 0
	? R
	: never;

export type MergeWithDefault<
	T extends Record<string, unknown>,
	Key extends string,
	Value,
> = Key extends keyof T ? T : T & { [K in Key]: Value };

export type Satisfies<U, T extends U> = T;

export type LiteralUnion<T extends U, U = string> = T | (U & {});
