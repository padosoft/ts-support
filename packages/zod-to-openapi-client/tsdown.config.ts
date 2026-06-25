import { tsdown } from "@padosoft/config/compiler/tsdown";

export default tsdown({
	entry: ["src/**/*.ts"],
	unbundle: true,
	exports: true,
});
