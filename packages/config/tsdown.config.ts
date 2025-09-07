import type { UserConfigFn } from "tsdown";
import { tsdown } from "./compiler/tsdown.ts";

const config: UserConfigFn = tsdown({
	entry: ["*/**/*.ts"],
	unbundle: true,
	external: ["tsdown", "rolldown"],
});

export default config;
