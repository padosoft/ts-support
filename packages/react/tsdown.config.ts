import { tsdown } from "@padosoft/config/compiler/tsdown";

export default tsdown({
	entry: ["src/**/*.ts", "src/**/*.tsx"],
	deps: {
		neverBundle: ["react", "@padosoft/utilities"],
	},
	unbundle: true,
	exports: true,
});
