import type { ResponseConfig } from "@asteasolutions/zod-to-openapi";
import type { Converter } from "../converter";
import type { HttpMethod } from "../utilities/constants";
import type { Endpoints } from "../utilities/endpoint";
import type { FindEndpointWithoutAutocomplete } from "../utilities/search";

export type ConvertEndpoints<
	T,
	TDefaultErrorResponse extends ResponseConfig = ResponseConfig,
> = {
	[P in Endpoints<T> as P["path"]]: {
		[M in HttpMethod as FindEndpointWithoutAutocomplete<
			T,
			P["path"],
			M
		> extends never
			? M
			: never]?: never;
	} & {
		[M in HttpMethod as FindEndpointWithoutAutocomplete<
			T,
			P["path"],
			M
		> extends never
			? never
			: M]: Converter<
			T,
			FindEndpointWithoutAutocomplete<T, P["path"], M>,
			TDefaultErrorResponse
		>;
	};
};
