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

export type Mutable<T> = { -readonly [P in keyof T]: T[P] };
export type DeepMutable<T> = T extends object
	? { [P in keyof T]: DeepMutable<T[P]> }
	: T;

export type OmitLast<T extends readonly unknown[]> = T extends [
	...infer Rest,
	(infer _Last)?,
]
	? Rest
	: never;

export type OmitFirst<T extends readonly unknown[]> = T extends [
	(infer _First)?,
	...infer Rest,
]
	? Rest
	: never;

export type Last<T extends readonly unknown[]> = T extends [
	...infer _Rest,
	(infer Last)?,
]
	? Last
	: never;

export type First<T extends readonly unknown[]> = T extends [
	(infer First)?,
	...infer _Rest,
]
	? First
	: never;
