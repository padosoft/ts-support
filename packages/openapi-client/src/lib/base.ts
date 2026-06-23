import type { LiteralUnion, Prettify } from "@padosoft/utilities";
import type { Client, ClientOptions, Middleware } from "openapi-fetch";
import createClient from "openapi-fetch";
import type { MediaType } from "openapi-typescript-helpers";
import type {
	ClientMethodReturn,
	ClientMiddleware,
	ClientMiddlewareFunctionParameters,
	ClientMiddlewareType,
	CreateClientMiddlewareOptions,
	CustomMiddlewareBaseParamsMap,
	CustomMiddlewareCallbackParams,
	CustomMiddlewareFunction,
	CustomMiddlewareKeys,
	OnResponseErrorMiddlewareFunction,
	OpenApiPaths,
	ReturnTypeFromClientMethod,
	StoredMiddleware,
} from "../types/base";

/**
 * Splits the `cause` field out of an error-details object so it can be attached
 * to the native `Error` (`{ cause }`) instead of being stringified into the message.
 */
function extractCause(details: unknown): { cause: unknown; rest: unknown } {
	if (details && typeof details === "object" && "cause" in details) {
		const { cause, ...rest } = details as Record<string, unknown>;
		return { cause, rest };
	}
	return { cause: undefined, rest: details };
}

/**
 * `JSON.stringify` that never throws: handles BigInt and circular references,
 * falling back to `String(value)` when serialization is impossible.
 */
function safeStringify(value: unknown): string {
	const seen = new WeakSet();
	try {
		return JSON.stringify(value, (_key, val) => {
			if (typeof val === "bigint") return val.toString();
			if (val && typeof val === "object") {
				if (seen.has(val)) return "[Circular]";
				seen.add(val);
			}
			return val;
		});
	} catch {
		return String(value);
	}
}

export function isOpenApiFetchClient<Paths extends OpenApiPaths>(
	v: unknown,
): v is Client<Paths, MediaType> {
	return (
		!!v &&
		typeof v === "object" &&
		"GET" in v &&
		typeof (v as { GET: unknown }).GET === "function"
	);
}

export class OpenApiClient<Paths extends OpenApiPaths> {
	protected client: Client<Paths, MediaType>;
	protected middlewares: Map<string, StoredMiddleware<typeof this>> = new Map();
	protected static INTERNAL_MIDDLEWARES: LiteralUnion<
		keyof Middleware,
		string
	>[] = ["onRequest", "onResponse", "onError"];

	/**
	 * @internal Creates a new openapi-fetch client instance
	 * @param options Client options
	 * @returns api client
	 */
	static createClient<Paths extends OpenApiPaths>(
		options?: ClientOptions,
	): Client<Paths> {
		if (options?.baseUrl && !options.baseUrl.endsWith("/")) {
			options.baseUrl = `${options.baseUrl}/`;
		}

		return createClient<Paths, MediaType>(options);
	}

	static createMiddleware<K extends ClientMiddlewareType, N extends string>(
		options: CreateClientMiddlewareOptions<K, N>,
	): Omit<CreateClientMiddlewareOptions<K, N>, "name"> & {
		name: N | (N extends undefined ? K : N);
	} {
		return {
			name: (options.name || options.type) as N extends undefined ? K : N,
			...options,
		};
	}

	constructor(optionsOrClient?: ClientOptions | Client<Paths, MediaType>) {
		if (isOpenApiFetchClient<Paths>(optionsOrClient)) {
			this.client = optionsOrClient;
		} else {
			this.client = OpenApiClient.createClient<Paths>(optionsOrClient);
		}
	}

	protected createApiError(status: number, details: unknown): Error {
		const { cause, rest } = extractCause(details);

		const error = new Error(
			`API Error ${status}: ${safeStringify(rest)}`,
			cause !== undefined ? { cause } : undefined,
		);
		return error;
	}

	private addClientToMiddleware<K extends keyof Middleware>(
		middleware: (
			options: ClientMiddlewareFunctionParameters<K, this>,
		) => ReturnType<NonNullable<Middleware[K]>>,
	): NonNullable<Middleware[K]> {
		//@ts-expect-error - Generic type mismatch when wrapping middleware, but works at runtime
		return (o: Parameters<NonNullable<Middleware[K]>>[0]) => {
			const options: ClientMiddlewareFunctionParameters<K, this> = {
				...o,
				client: this,
			} as const;

			return middleware(options);
		};
	}

	use<K extends ClientMiddlewareType>(
		middleware: ClientMiddleware<K, string, this>,
	): this {
		this.middlewares.set(middleware.name, middleware as StoredMiddleware<this>);

		if (!OpenApiClient.INTERNAL_MIDDLEWARES.includes(middleware.type)) {
			return this;
		}

		const middlewareObj = {
			[middleware.type]: (
				this.addClientToMiddleware as (m: unknown) => unknown
			)(middleware.middleware),
		} satisfies Partial<Middleware>;
		this.client.use(middlewareObj as Middleware);

		return this;
	}

	eject(name: string): this {
		const middleware = this.middlewares.get(name);
		if (!middleware) return this;

		this.middlewares.delete(name);

		if (!OpenApiClient.INTERNAL_MIDDLEWARES.includes(middleware.type)) {
			return this;
		}

		const middlewareObj = {
			[middleware.type]: middleware.middleware,
		} satisfies Partial<Middleware>;
		this.client.eject(middlewareObj as Middleware);

		return this;
	}

	onError(
		middleware:
			| CustomMiddlewareFunction<"onError", this>
			| ClientMiddleware<"onError", string, this>,
	): this {
		if ("middleware" in middleware) {
			return this.use(middleware);
		}

		return this.use({
			name: "onError",
			type: "onError",
			middleware: this.addClientToMiddleware(middleware),
		});
	}

	onRequest(
		middleware:
			| CustomMiddlewareFunction<"onRequest", this>
			| ClientMiddleware<"onRequest", string, this>,
	): this {
		if ("middleware" in middleware) {
			return this.use(middleware);
		}

		return this.use({
			name: "onRequest",
			type: "onRequest",
			middleware: this.addClientToMiddleware(middleware),
		});
	}

	onResponse(
		middleware:
			| CustomMiddlewareFunction<"onResponse", this>
			| ClientMiddleware<"onResponse", string, this>,
	): this {
		if ("middleware" in middleware) {
			return this.use(middleware);
		}

		return this.use({
			name: "onResponse",
			type: "onResponse",
			middleware: this.addClientToMiddleware(middleware),
		});
	}

	protected async executeMiddlewaresOfType<K extends CustomMiddlewareKeys>(
		type: K,
		params: CustomMiddlewareBaseParamsMap[K],
		executeCallback: (
			middleware: ClientMiddleware<K, string, this>,
			options: CustomMiddlewareCallbackParams<K, this>,
		) => Promise<void> = async (m, p) => {
			const middleware = m as ClientMiddleware<
				CustomMiddlewareKeys,
				string,
				this
			>;
			return await middleware.middleware(p);
		},
	): Promise<void> {
		for (const middleware of this.middlewares.values()) {
			if (middleware.type !== type) continue;

			const options = {
				...params,
				client: this,
			} satisfies CustomMiddlewareCallbackParams<K, this>;

			try {
				await executeCallback(
					middleware as ClientMiddleware<K, string, this>,
					options,
				);
			} catch {}
		}
	}

	onResponseError(
		middleware:
			| OnResponseErrorMiddlewareFunction<this>
			| ClientMiddleware<"onResponseError", string, this>,
	): this {
		if ("middleware" in middleware) {
			return this.use(middleware);
		}

		return this.use({
			name: "onResponseError",
			type: "onResponseError",
			middleware,
		});
	}

	protected async wrapFetchCall<R extends ClientMethodReturn>(
		promise: Promise<R>,
	): Promise<Prettify<ReturnTypeFromClientMethod<R>>> {
		const res = await promise;

		if (res.data) {
			//@ts-expect-error res.data è unkown e non R["data"]["schema"] poichè SuccessfulClientMethodReturn non accetta un generico schema di ritorno (per questioni di performance), quindi va fatto il cast
			return res.data;
		}

		// Gestisce 204 No Content (response senza body)
		if (res.response.status === 204) {
			//@ts-expect-error undefined è valido per risposte 204
			return undefined;
		}

		if (!res.error?.message) {
			const error = this.createApiError(res.response.status, {
				cause: res.response,
				code: "UNKNOWN",
			});

			this.executeMiddlewaresOfType("onResponseError", {
				response: res.response,
				error,
			});

			throw error;
		}

		const error = this.createApiError(res.response.status, res.error);
		this.executeMiddlewaresOfType("onResponseError", {
			response: res.response,
			error,
		});

		throw error;
	}
}
