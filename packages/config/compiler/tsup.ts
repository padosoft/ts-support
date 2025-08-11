import { defineConfig, type Options } from "tsup";

export const tsup = (packageOptions?: Options) => {
	return defineConfig((overrideOptions) => {
		const options = {
			...overrideOptions,
			...packageOptions,
		};

		return {
			clean: true,
			dts: true,
			splitting: true,
			treeshake: true,
			minify: !options.watch,
			format: ["cjs", "esm"],
			outDir: "dist",
			...options,
		};
	});
};
