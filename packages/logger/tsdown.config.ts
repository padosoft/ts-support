import { tsdown } from "@padosoft/config/tsdown";

export default tsdown({
	entry: ["src/**/*.ts"],
	deps: {
		neverBundle: ["zod", /^@opentelemetry\/.*/],
		onlyBundle: [],
	},
	exports: true,
	unbundle: true,
});
