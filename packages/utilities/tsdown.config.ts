import { tsdown } from "@padosoft/config/compiler/tsdown";

export default tsdown({
	entry: ["src/**/*.ts"],
	deps: {
		neverBundle: ["zod"],
	},
	unbundle: true,
	exports: true,
});
