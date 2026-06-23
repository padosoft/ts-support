import type { ResponseConfig } from "@asteasolutions/zod-to-openapi";
import type { Converter } from "../converter";
import type { HttpMethod } from "../utilities/constants";
import type { Endpoints } from "../utilities/endpoint";
import type { FindEndpointWithoutAutocomplete } from "../utilities/search";

export type SetupEndpoints<
	T,
	TDefaultErrorResponse extends ResponseConfig = ResponseConfig,
> = {
	[P in Endpoints<T> as P["path"]]: {
		[M in HttpMethod]: FindEndpointWithoutAutocomplete<
			T,
			P["path"],
			M
		> extends never
			? never
			: Converter<
					T,
					FindEndpointWithoutAutocomplete<T, P["path"], M>,
					TDefaultErrorResponse
				>;
	};
};
