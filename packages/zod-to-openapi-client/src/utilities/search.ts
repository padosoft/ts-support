import type { ResponseConfig } from "@asteasolutions/zod-to-openapi";
import type { Converter } from "../converter";
import type { HttpMethod } from "./constants";
import type { Endpoints, EndpointsMethods } from "./endpoint";

type FindEndpointBymethod<T, M extends HttpMethod> = Extract<
	Endpoints<T>,
	{ method: M }
>;

export type FindEndpointWithoutAutocomplete<
	T,
	P extends string,
	M extends HttpMethod,
> = Extract<FindEndpointBymethod<T, M>, { path: P }>;

export type GetSpecEndpoint<
	T,
	M extends EndpointsMethods<T>,
	P extends FindEndpointBymethod<T, M>["path"],
> = Extract<Endpoints<T>, { method: M; path: P }>;

export type GetEndpoint<
	T,
	M extends EndpointsMethods<T>,
	P extends FindEndpointBymethod<T, M>["path"],
	TDefaultErrorResponse extends ResponseConfig = ResponseConfig,
> = Converter<T, Extract<Endpoints<T>, { method: M; path: P }>, TDefaultErrorResponse>;
