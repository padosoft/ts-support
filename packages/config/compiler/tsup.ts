import { defineConfig, type Options } from "tsup";

export const tsup = (packageOptions?: Options) => {
	return defineConfig((overrideOptions) => {
		const options = {
			...overrideOptions,
			...packageOptions,
		};

		if (Array.isArray(options.entry)) {
			options.entry.push("!dist");
		}

		return {
			clean: true,
			dts: true,
			splitting: false,
			treeshake: true,
			minify: !options.watch,
			format: ["cjs", "esm"],
			outDir: "dist",
			...options,
		};
	});
};
