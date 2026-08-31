import type * as z from "zod/v4/core";

/**
 * Selects which TypeScript type to extract from a Zod schema.
 *
 * - `"input"` — the shape **before** parsing: `.default()` fields are optional,
 *   coercions/transforms are widened. This is what a value looks like when it is
 *   *sent* to the schema (e.g. a client building a request the server validates).
 * - `"output"` / `"infer"` — the shape **after** parsing: defaults are present,
 *   transforms applied. This is what a value looks like once validated (e.g. a
 *   response the server returns). `output` and `infer` are equivalent in Zod.
 */
export type ZodInferMode = "input" | "output" | "infer";

/**
 * Extracts a TypeScript type from a Zod schema according to {@link ZodInferMode}.
 * `"output"` and `"infer"` both resolve to `z.output<T>` (they are the same type).
 */
export type InferZod<
	T extends z.$ZodType,
	Mode extends ZodInferMode = "infer",
> = Mode extends "input" ? z.input<T> : z.output<T>;

/**
 * If `T` is a Zod schema, extract its type (per `Mode`, default `"infer"` =
 * output); otherwise pass `T` through unchanged.
 */
export type ConvertMaybeZod<
	T,
	Mode extends ZodInferMode = "infer",
> = T extends z.$ZodType ? InferZod<T, Mode> : T;

/**
 * Like {@link ConvertMaybeZod} but recurses into arrays and object properties.
 * The chosen `Mode` is applied to every nested Zod schema.
 */
export type DeepConvertMaybeZod<
	T,
	Mode extends ZodInferMode = "infer",
> = T extends z.$ZodType
	? InferZod<T, Mode>
	: T extends Array<infer U>
		? DeepConvertMaybeZod<U, Mode>[]
		: T extends ReadonlyArray<infer U>
			? Readonly<DeepConvertMaybeZod<U, Mode>>[]
			: T extends object
				? { [K in keyof T]: DeepConvertMaybeZod<T[K], Mode> }
				: T;
