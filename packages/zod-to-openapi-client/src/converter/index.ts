import type { ResponseConfig } from "@asteasolutions/zod-to-openapi";
import type { Endpoints, ExtractEndpointInfo } from "../utilities/endpoint";
import type { ConvertRequestBody } from "./body";
import type { ConvertParameters } from "./parameters";
import type { ConvertResponses } from "./responses";

export interface Converter<
	T,
	Endpoint extends Endpoints<T>,
	TDefaultErrorResponse extends ResponseConfig = ResponseConfig,
> extends ConvertRequestBody<T, Endpoint>,
		ConvertParameters<T, Endpoint>,
		ConvertResponses<T, Endpoint, TDefaultErrorResponse> {
	_meta: ExtractEndpointInfo<Endpoint>;
}
