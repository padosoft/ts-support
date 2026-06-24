import { z } from "zod";

export const withZodDefaults = <T extends z.ZodRawShape, K extends keyof T>(
	schema: z.ZodObject<T>,
	defaults: Partial<Record<K, z.infer<T[K]>>>,
) =>
	z.object(
		Object.fromEntries(
			Object.entries(schema.shape).map(([key, value]) => {
				const defaultVal = defaults[key as K];
				const newValue =
					defaultVal !== undefined
						? (value as z.ZodTypeAny).default(defaultVal)
						: value;
				return [key, newValue] as const;
			}),
		) as Required<Record<K, NonNullable<z.ZodDefault<T[K]>>>>,
	);
