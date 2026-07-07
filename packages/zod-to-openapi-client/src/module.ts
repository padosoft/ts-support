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
 * @typeParam TModuleKey - The query key prefix for this module, e.g.
 *   `readonly ['v1', 'auth']`. Drives the type of `.$query.all` and all
 *   generated keys. Defaults to `readonly []` (no prefix). Pass the value
 *   as the second constructor argument — typically done once in the leaf
 *   class (or in a shared base like `V1BaseModule`) so call sites stay clean.
 *
 * @example
 * ```ts
 * // V1BaseModule — shared base that wires up the version prefix automatically.
 * abstract class V1BaseModule<
 *   TRoutes extends object,
 *   TKey extends string,
 * > extends OpenApiClientModule<TRoutes, MyErrorResponse, readonly ['v1', TKey]> {
 *   constructor(optionsOrClient: ClientArg, key: TKey) {
 *     super(optionsOrClient, ['v1', key]);
 *   }
 * }
 *
 * // Concrete module — only passes its own key string.
 * class AuthV1Module extends V1BaseModule<[typeof authRoutes], 'auth'> {
 *   constructor(optionsOrClient: ClientArg) {
 *     super(optionsOrClient, 'auth');
 *   }
 *
 *   login(body: LoginBody) {
 *     return this.wrapFetchCall(this.client.POST("/auth/login", { body }));
 *   }
 * }
 *
 * const auth = new AuthV1Module(client);
 * auth.$query.all            // → readonly ['v1', 'auth']
 * auth.$query.login.$key(b)  // → readonly ['v1', 'auth', 'login', b]
 * ```
 *
 * @example
 * ```ts
 * // Without a module key — no prefix, backward-compatible default.
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
	TModuleKey extends readonly string[] = readonly [],
> extends OpenApiClient<
	CreateClientPaths<RoutesInput<TRoutes>, TDefaultErrorResponse>
> {
	protected queryProxy?: QueryProxy<this, TModuleKey>;
	protected readonly baseKey: TModuleKey;

	constructor(
		[...params]: ConstructorParameters<
			typeof OpenApiClient<
				CreateClientPaths<RoutesInput<TRoutes>, TDefaultErrorResponse>
			>
		>,
		baseKey?: TModuleKey,
	) {
		super(...params);

		this.baseKey = baseKey ?? ([] as unknown as TModuleKey);
	}

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
	 * auth.$query.login.$key(body)   // → ['v1', 'auth', 'login', body]
	 * auth.$query.all                // → ['v1', 'auth']
	 *
	 * useQuery({ ...auth.$query.login.$query(body) });
	 * ```
	 */
	get $query(): QueryProxy<this, TModuleKey> {
		if (!this.queryProxy) {
			this.queryProxy = createQueryProxy(this, this.baseKey);
		}

		return this.queryProxy;
	}
}
