// tsdown-plugin-replace-z-import.ts

import type { Plugin } from "rolldown";

const replaceZodOpenapiImportPlugin: Plugin = {
	name: "replace-z-hono-openapi-import",

	transform(code, id) {
		// Only process .ts or .tsx files
		if (!id.endsWith(".ts") && !id.endsWith(".tsx")) return;

		const updatedCode = code.replace(
			/import\s*\{\s*z\s*\}\s*from\s*["']hono\/openapi["'];?/g,
			`import { z } from "zod";`,
		);

		return {
			code: updatedCode,
		};
	},
};

export default replaceZodOpenapiImportPlugin;
