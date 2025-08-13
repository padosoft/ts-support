import { defineConfig, type Options, type UserConfigFn } from "tsdown";

export const tsdown = (packageOptions?: Options): UserConfigFn => {
	return defineConfig((overrideOptions) => {
		const options = {
			...overrideOptions,
			...packageOptions,
		};

		if (Array.isArray(options.entry)) {
			options.entry.push("!dist");
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
