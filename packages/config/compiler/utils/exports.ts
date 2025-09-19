import type { ExportsOptions } from "tsdown";

export const defaultCustomExports: NonNullable<
	ExportsOptions["customExports"]
> = (exports) => {
	const fixed: typeof exports = {};

	for (const [key, value] of Object.entries(exports)) {
		const normalizedKey = key.replace(/\\/g, "/");
		const normalizedValue = value.replace(/\\/g, "/");
		fixed[normalizedKey] = normalizedValue;
	}

	return fixed;
};
