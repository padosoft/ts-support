import type { Middleware } from "openapi-fetch";
import type { HttpMethod } from "openapi-typescript-helpers";

export interface DefaultPaths
	extends Record<string, Partial<Record<HttpMethod, unknown>>> {}

export interface BaseClientMethodReturn {
	response: Response;
}

export interface SuccessfulClientMethodReturn extends BaseClientMethodReturn {
	data: {
		schema: unknown;
	};
	error?: never;
}

export interface FailedClientMethodReturn extends BaseClientMethodReturn {
	error?: { message?: string; [key: string]: unknown };
	data?: never;
}

export type ClientMethodReturn =
	| SuccessfulClientMethodReturn
	| FailedClientMethodReturn;

export type ApiClientFunctionData<P extends SuccessfulClientMethodReturn> =
	P["data"];

export type ApiClientFunctionDataSchema<
	P extends SuccessfulClientMethodReturn,
> = ApiClientFunctionData<P>["schema"];

export type PartialReturnTypeFromClientMethod<R extends ClientMethodReturn> =
	R extends SuccessfulClientMethodReturn ? R["data"]["schema"] : never;

export type ReturnTypeFromClientMethod<R extends ClientMethodReturn> =
	PartialReturnTypeFromClientMethod<R>;

export type ClientMiddlewareFunctionParameters<
	K extends keyof Middleware,
	Client = unknown,
> = Parameters<NonNullable<Middleware[K]>>[0] & { client: Client };

/**
 * Base (no `client`) callback params for each custom middleware type.
 * Extend this map to add new custom middleware types.
 */
export interface CustomMiddlewareBaseParamsMap {
	onResponseError: {
		response: Response;
		error: Error;
	};
}

/**
 * Keys for custom middleware (e.g. "onResponseError").
 */
export type CustomMiddlewareKeys = keyof CustomMiddlewareBaseParamsMap;

/**
 * Get return type for a specific custom middleware type.
 * Extend this to specify return types for future custom middlewares.
 */
export interface CustomMiddlewareReturnTypeMap {
	onResponseError: void | Promise<void>;
}

export type CustomMiddlewareReturnType<
	K extends keyof CustomMiddlewareReturnTypeMap,
> = CustomMiddlewareReturnTypeMap[K];

/**
 * Full callback params for a custom middleware: base params + injected `client`.
 */
export type CustomMiddlewareCallbackParams<
	K extends CustomMiddlewareKeys,
	Client = unknown,
> = CustomMiddlewareBaseParamsMap[K] & { client: Client };

export type OnResponseErrorMiddlewareFunction<Client = unknown> = (
	options: CustomMiddlewareCallbackParams<"onResponseError", Client>,
) => CustomMiddlewareReturnType<"onResponseError">;

export type ClientMiddlewareType = keyof Middleware | CustomMiddlewareKeys;

export type CustomMiddlewareFunction<
	K extends keyof Middleware,
	Client = unknown,
	Options = ClientMiddlewareFunctionParameters<K, Client>,
> = (options: Options) => ReturnType<NonNullable<Middleware[K]>>;

export interface ClientMiddleware<
	K extends ClientMiddlewareType = ClientMiddlewareType,
	N extends string = string,
	C = unknown,
> {
	name: N;
	type: K;
	/**
	 * The middleware function.
	 *
	 * @example
	 * ```ts
	 * ApiClient.createMiddleware({
	 *   name: "example-middleware",
	 *   type: "onRequest",
	 *   middleware: async ({ request }) => {
	 *     // Modify the request or perform actions before the request is sent
	 *     console.log("Request URL:", request.url);
	 *     return request;
	 *   },
	 * });
	 * ```
	 *
	 * using the client instance inside the middleware allows to access its methods and properties:
	 *
	 * ```ts
	 * ApiClient.createMiddleware({
	 *   name: "example-middleware",
	 *   type: "onRequest",
	 *   middleware: async ({ request, client }: ClientMiddlewareFunctionParameters<"onRequest", ApiClient>) => {
	 *     // Modify the request or perform actions before the request is sent
	 *     console.log("Request URL:", request.url);
	 *     return request;
	 *   },
	 * });
	 * ```
	 */
	middleware: (
		p: K extends keyof Middleware
			? Parameters<CustomMiddlewareFunction<K, C>>[0]
			: CustomMiddlewareCallbackParams<K & CustomMiddlewareKeys, C>,
	) => K extends keyof Middleware
		? ReturnType<CustomMiddlewareFunction<K, C>>
		: K extends CustomMiddlewareKeys
			? CustomMiddlewareReturnType<K>
			: never;
}

export interface CreateClientMiddlewareOptions<
	K extends ClientMiddlewareType,
	N extends string = string,
	// biome-ignore lint/suspicious/noExplicitAny: No way to avoid any here
	C = any,
> extends Omit<ClientMiddleware<K, N, C>, "name"> {
	/**
	 * The name of the middleware. If not provided, the type will be used as the name.
	 * By omitting name/using the type, only one middleware of each type can be added to the client.
	 */
	name?: N;
}

/**
 * Type alias for all stored middleware entries (native and custom).
 * Automatically extends when new middleware types are added to ClientMiddlewareType.
 */
export type StoredMiddleware<C> = ClientMiddleware<
	ClientMiddlewareType,
	string,
	C
>;
