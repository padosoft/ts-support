import type { ExportsOptions } from "tsdown";

export const defaultCustomExports: NonNullable<
	ExportsOptions["customExports"]
> = (exports) => {
	const fixed: typeof exports = {};

	const handlers: Record<
		string,
		(value: string, ext: string) => { default: string; types: string }
	> = {
		".js": (v, e) => ({
			default: v,
			types: `${v.slice(0, -e.length)}.d.ts`,
		}),
		".mjs": (v, e) => ({
			default: v,
			types: `${v.slice(0, -e.length)}.d.mts`,
		}),
	};

	for (const [key, value] of Object.entries(exports)) {
		const normalizedKey = key.replace(/\\/g, "/");
		const normalizedValue =
			typeof value === "string" ? value.replace(/\\/g, "/") : value;

		if (typeof normalizedValue !== "string") {
			fixed[normalizedKey] = normalizedValue;
			continue;
		}

		const handler = Object.entries(handlers).find(([ext]) =>
			normalizedValue.endsWith(ext),
		);

		if (!handler) {
			fixed[normalizedKey] = normalizedValue;
			continue;
		}

		const [ext, fn] = handler;
		fixed[normalizedKey] = fn(normalizedValue, ext);
	}

	return fixed;
};
