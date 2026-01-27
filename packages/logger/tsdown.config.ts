import { tsdown } from "@padosoft/config/tsdown";

export default tsdown({
	entry: ["src/**/*.ts"],
	external: ["zod", /^@opentelemetry\/.*/],
	inlineOnly: [],
	exports: true,
	unbundle: true,
});
