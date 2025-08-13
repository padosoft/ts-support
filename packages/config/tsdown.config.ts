import { tsdown } from "./compiler/tsdown.ts";

export default tsdown({
	entry: ["*/**/*.ts"],
	unbundle: true,
	external: ["tsdown"],
});
