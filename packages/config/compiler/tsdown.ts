import {
	defineConfig,
	type ExportsOptions,
	type Options,
	type UserConfigFn,
} from "tsdown";

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

export const tsdown = (packageOptions?: Options): UserConfigFn => {
	return defineConfig((overrideOptions) => {
		const options = {
			...overrideOptions,
			...packageOptions,
		};

		if (Array.isArray(options.entry)) {
			options.entry.push("!dist");
		}

		/**
		 * Apply default exports transformation
		 */
		if (options.exports && typeof options.exports === "boolean") {
			options.exports = {
				customExports: defaultCustomExports,
			};
		}

		return {
			dts: true,
			splitting: false,
			treeshake: true,
			minify: !options.watch,
			outDir: "dist",
			...options,
		};
	});
};
