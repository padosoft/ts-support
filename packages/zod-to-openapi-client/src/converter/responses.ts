import type { ResponseConfig } from "@asteasolutions/zod-to-openapi";
import type {
	DeepConvertMaybeZod,
	MergeWithDefault,
} from "@padosoft/utilities";
import type { Endpoints } from "../utilities/endpoint";

type InterestingResponseStatuses = 200 | "default";
type InterestingResponseFields = keyof Pick<
	ResponseConfig,
	"content" | "headers" | "description"
>;

export interface ConvertResponses<
	T,
	Endpoint extends Endpoints<T>,
	TDefaultErrorResponse extends ResponseConfig = ResponseConfig,
> {
	responses: MergeWithDefault<
		{
			[Status in Extract<
				InterestingResponseStatuses,
				keyof Endpoint["responses"]
			>]: Endpoint["responses"][Status] extends infer Response
				? Response extends ResponseConfig
					? {
							[InfoField in keyof Pick<
								Response,
								InterestingResponseFields
							>]: Response[InfoField] extends infer ResponseInfoField
								? DeepConvertMaybeZod<ResponseInfoField>
								: never;
						}
					: never
				: never;
		},
		"default",
		TDefaultErrorResponse
	>;
}
