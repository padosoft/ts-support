import { tsdown } from "@padosoft/config/compiler/tsdown";

export default tsdown({
	entry: ["src/index.ts"],
	deps: {
		neverBundle: [],
	},
	banner: ({ fileName }) => {
		if (fileName !== "src/index.ts") return "";

		return "#!/usr/bin/env node";
	},
	exports: {
		bin: { padosoft: "./src/index.ts" },
	},
});
