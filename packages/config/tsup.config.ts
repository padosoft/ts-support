import { tsup } from "./compiler/tsup";

export default tsup({
	entry: ["*/**/*.ts"],
	format: ["esm"],
	external: ["tsup"],
	esbuildOptions(options) {
		options.outbase = "./";
	},
});
