import { tsdown } from "@padosoft/config/tsdown";

export default tsdown({
	entry: ["src/**/*.ts"],
	deps: {
		neverBundle: ["zod"],
	},
	unbundle: true,
	exports: true,
});
