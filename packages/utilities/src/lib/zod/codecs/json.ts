import z from "zod";

export const jsonCodec = <T extends z.core.$ZodType>(
	schema: T,
): z.ZodCodec<z.ZodString, T> =>
	z.codec(z.string(), schema, {
		decode: (jsonString, ctx) => {
			try {
				return JSON.parse(jsonString);
			} catch (err: unknown) {
				const errorMessage = err instanceof Error ? err.message : String(err);

				ctx.issues.push({
					code: "invalid_format",
					format: "json",
					input: jsonString,
					message: errorMessage,
				});

				return z.NEVER;
			}
		},
		encode: (value) => JSON.stringify(value),
	});
