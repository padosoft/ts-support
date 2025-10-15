import type { ExportsOptions } from "tsdown";

export const defaultCustomExports: NonNullable<
	ExportsOptions["customExports"]
> = (exports) => {
	const fixed: typeof exports = {};

	for (const [key, value] of Object.entries(exports)) {
		const normalizedKey = key.replace(/\\/g, "/");
		const normalizedValue = value.replace(/\\/g, "/");

		if (typeof normalizedValue !== "string") {
			fixed[normalizedKey] = normalizedValue;
			continue;
		}

		if (!normalizedValue.endsWith(".js")) {
			fixed[normalizedKey] = normalizedValue;
			continue;
		}

		const newExt = `${normalizedValue.slice(0, -3)}.d.ts`;
		fixed[normalizedKey] = {
			default: normalizedValue,
			types: newExt,
		};
	}

	return fixed;
};
