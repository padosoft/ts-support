import * as z from "zod";
import {
	MigrationSchema,
	RecipeSchema,
	StackDefinitionSchema,
	StackManifestSchema,
} from "./schemas";

/** JSON Schema files published in `schema/`, keyed by file name. */
export const renderSchemas = (): Record<string, string> => {
	const render = (schema: z.ZodType) =>
		`${JSON.stringify(z.toJSONSchema(schema, { io: "input" }), null, "\t")}\n`;
	return {
		"stack-manifest.json": render(StackManifestSchema),
		"stack.json": render(StackDefinitionSchema),
		"migration.json": render(MigrationSchema),
		"recipe.json": render(RecipeSchema),
	};
};
