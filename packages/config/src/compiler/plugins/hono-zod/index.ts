import {
	createUnplugin,
	type RolldownPlugin,
	type UnpluginFactory,
	type UnpluginInstance,
} from "unplugin";

const HONO_OPENAPI_IMPORT =
	/import\s*\{\s*z\s*\}\s*from\s*["']hono\/openapi["'];?/g;

/**
 * Rewrites `import { z } from "hono/openapi"` to `import { z } from "zod"`
 * in `.ts`/`.tsx` files, across every bundler supported by unplugin.
 */
export const unpluginFactory: UnpluginFactory<undefined> = () => ({
	name: "replace-z-hono-openapi-import",

	transformInclude(id) {
		return id.endsWith(".ts") || id.endsWith(".tsx");
	},

	transform(code) {
		return code.replace(HONO_OPENAPI_IMPORT, `import { z } from "zod";`);
	},
});

export const unplugin: UnpluginInstance<undefined> =
	createUnplugin(unpluginFactory);

// Backward-compatible default: a rolldown plugin, matching the previous export
// shape (the repo bundler is rolldown/tsdown).
const rolldownPlugin: RolldownPlugin = unplugin.rolldown();

export default rolldownPlugin;
