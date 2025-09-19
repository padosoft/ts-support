import { defineConfig, type Options, type UserConfigFn } from "tsdown";
import { defaultCustomExports } from "./utils/exports.ts";

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
