import { tsdown } from "@padosoft/config/compiler/tsdown";

export default tsdown({
	entry: ["src/index.ts"],
	deps: {
		neverBundle: [],
	},
	exports: {
		bin: true,
	},
});
