import type { RouteConfig } from "@asteasolutions/zod-to-openapi";
import type { ConvertMaybeZod } from "@padosoft/utilities";
import type {
	NoParameters,
	ParametersNameFetchClientToSpec,
} from "../utilities/constants";
import type { Endpoints } from "../utilities/endpoint";

export interface ConvertParameters<T, Endpoint extends Endpoints<T>> {
	parameters: {
		path?: Record<string, unknown>;
	} & (Endpoint extends {
		request?: infer Request;
	}
		? Request extends RouteConfig["request"]
			? {
					[Key in keyof ParametersNameFetchClientToSpec]?:
						| (NonNullable<Request>[ParametersNameFetchClientToSpec[Key]] extends infer ParameterConfig
								? // Request params use the zod INPUT type: `.default()` fields
									// are optional for the caller (the server applies the default).
									ConvertMaybeZod<ParameterConfig, "input">
								: NoParameters)
						| undefined;
				}
			: NoParameters
		: NoParameters);
}
