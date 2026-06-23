import type { RouteConfig } from "@asteasolutions/zod-to-openapi";

export type HttpMethod =
	| "get"
	| "put"
	| "post"
	| "delete"
	| "options"
	| "head"
	| "patch"
	| "trace";

export interface ParametersNameFetchClientToSpec {
	path: "params";
	query: "query";
	cookie: "cookies";
	header: "headers";
}

export type Parameters<
	R extends RouteConfig["request"] = RouteConfig["request"],
> = keyof Omit<NonNullable<R>, "body">;

export interface NoParameters extends Partial<Record<Parameters, never>> {}

export type MetaKeys = keyof Pick<
	RouteConfig,
	| "tags"
	| "operationId"
	| "summary"
	| "externalDocs"
	| "deprecated"
	| "description"
>;
