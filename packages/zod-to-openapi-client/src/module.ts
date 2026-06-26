import type { ResponseConfig } from "@asteasolutions/zod-to-openapi";
import { OpenApiClient } from "@padosoft/openapi-client";
import type { QueryProxy } from "@padosoft/utilities/lib/query-proxy";
import { createQueryProxy } from "@padosoft/utilities/lib/query-proxy";
import type { CreateClientPaths } from "./index";

/**
 * Normalizes a route tuple `[A, B, C]` into a named record
 * `{ route_0: A; route_1: B; route_2: C }`, which is a valid `TCollections`
 * input for {@link CreateClientPaths}. Object inputs pass through unchanged.
 *
 * Key names are arbitrary — `CreateClientPaths` cares only about the values
 * (the route types), so `route_0`, `route_1`, … are just stable unique keys
 * for the tuple positions.
 */
export type RoutesInput<T> = T extends readonly unknown[]
	? { [K in keyof T as K extends `${number}` ? `route_${K}` : never]: T[K] }
	: T;

/**
 * Abstract base class that bridges {@link OpenApiClient} with {@link CreateClientPaths},
 * so subclasses only need to declare their route types — no manual
 * `CreateClientPaths` wrapping or imports needed.
 *
 * Pass a custom `TDefaultErrorResponse` to get fully typed error responses
 * on every endpoint across the entire module.
 *
 * > **Peer dependency**: requires `@padosoft/openapi-client` to be installed.
 *
 * @typeParam TRoutes - Routes as a **tuple** `[typeof routeA, typeof routeB, ...]`
 *   or **object** `{ key: typeof routeA }`. Normalized via {@link RoutesInput}
 *   before being passed to `CreateClientPaths`.
 * @typeParam TDefaultErrorResponse - `ResponseConfig` shape for the `"default"`
 *   error slot on every endpoint. Defaults to the base `ResponseConfig`.
 *   Override with your typed error schema for end-to-end error typing.
 *
 * @example
 * ```ts
 * // With a project-specific typed error response
 * interface MyErrorResponse extends ResponseConfig {
 *   content: { "application/json": { schema: MyErrorSchema } };
 *   description: "Error";
 * }
 *
 * class AuthModule extends OpenApiClientModule<
 *   [typeof authRoutes, typeof sessionRoutes],
 *   MyErrorResponse
 * > {
 *   protected override createApiError(status: number, details: unknown): Error {
 *     return new MyApiError(status, details);
 *   }
 *
 *   login(body: LoginBody) {
 *     return this.wrapFetchCall(this.client.POST("/auth/login", { body }));
 *   }
 * }
 * ```
 *
 * @example
 * ```ts
 * // Without a custom error schema — uses base ResponseConfig
 * class CatalogModule extends OpenApiClientModule<[typeof catalogRoutes]> {
 *   getProducts() {
 *     return this.wrapFetchCall(this.client.GET("/catalog/products"));
 *   }
 * }
 * ```
 */
export abstract class OpenApiClientModule<
	TRoutes extends object,
	TDefaultErrorResponse extends ResponseConfig = ResponseConfig,
> extends OpenApiClient<CreateClientPaths<RoutesInput<TRoutes>, TDefaultErrorResponse>> {
	private queryProxy?: QueryProxy<this>;

	/**
	 * Returns a query proxy that augments every async method with `.$key()` and
	 * `.$query()` helpers for React Query / TanStack Query.
	 *
	 * The proxy is memoized — the same object is returned on every access.
	 *
	 * @example
	 * ```ts
	 * const auth = new AuthV1Module(client);
	 *
	 * // Key — derived automatically from the access path + call arguments:
	 * auth.$query.login.$key(body)   // → ["login", body]
	 *
	 * // Spread directly into useQuery:
	 * useQuery({ ...auth.$query.login.$query(body) });
	 * ```
	 */
	get $query(): QueryProxy<this> {
		this.queryProxy ??= createQueryProxy(this);
		return this.queryProxy;
	}
}
