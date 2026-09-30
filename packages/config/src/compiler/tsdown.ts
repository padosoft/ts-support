import { defineConfig, type InlineConfig, type UserConfigFn } from "tsdown";
import { referenceDirectives } from "./plugins/reference-directives.ts";
import { defaultCustomExports } from "./utils/exports.ts";

export const tsdown = (packageOptions?: InlineConfig): UserConfigFn => {
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
			plugins: [options.plugins, referenceDirectives()],
		};
	});
};
