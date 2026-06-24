import type { ResponseConfig } from "@asteasolutions/zod-to-openapi";
import type { Prettify } from "@padosoft/utilities";
import type { ConvertEndpoints } from "./steps/convert-endpoints";
import type { SetupEndpoints } from "./steps/setup-endpoints";
import type { SetupParams } from "./steps/setup-params";

/**
 * Converts a record of zod-to-openapi route collections into a typed `Paths`
 * object compatible with `openapi-fetch` and `@padosoft/openapi-client`.
 *
 * @typeParam TCollections - A record whose values are route collections produced
 *   by `@asteasolutions/zod-to-openapi`. Each collection may carry a `config`
 *   property with a `path` prefix (e.g. `{ path: "/v1/auth" }`).
 *
 * @typeParam TDefaultErrorResponse - The `ResponseConfig` shape used to fill the
 *   `"default"` response slot on every endpoint. Defaults to the base
 *   `ResponseConfig` type. Pass your own error schema to get typed error responses:
 *
 * @example
 * ```ts
 * // No custom error schema — uses base ResponseConfig
 * type MyPaths = CreateClientPaths<typeof myEndpoints>;
 *
 * // With a custom error response type
 * interface MyErrorResponse extends ResponseConfig {
 *   content: { "application/json": { schema: MyErrorSchema } };
 *   description: "Error";
 * }
 * type MyPaths = CreateClientPaths<typeof myEndpoints, MyErrorResponse>;
 * ```
 */
export type CreateClientPaths<
	TCollections,
	TDefaultErrorResponse extends ResponseConfig = ResponseConfig,
> = Prettify<
	SetupParams<TCollections> &
		SetupEndpoints<TCollections, TDefaultErrorResponse> &
		ConvertEndpoints<TCollections, TDefaultErrorResponse>
>;

export type { GetEndpoint, GetSpecEndpoint } from "./utilities/search";
export type { Endpoints, EndpointsMethods, EndpointsPaths } from "./utilities/endpoint";
export type { HttpMethod } from "./utilities/constants";
export { OpenApiClientModule, type RoutesInput } from "./module";
