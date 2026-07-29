import { tsdown } from "@padosoft/config/compiler/tsdown";

export default tsdown({
	entry: ["src/**/*.ts"],
	deps: {
		neverBundle: ["openapi-fetch", "openapi-typescript-helpers"],
	},
	unbundle: true,
	exports: true,
});
