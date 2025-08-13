import { tsdown } from "@padosoft/config/tsdown";

export default tsdown({
	entry: ["src/**/*.ts"],
	external: ["zod"],
});
