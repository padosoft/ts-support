import type { NoParameters } from "../utilities/constants";
import type { EndpointsPaths } from "../utilities/endpoint";

export type SetupParams<T> = {
	[Path in EndpointsPaths<T>]: {
		parameters: NoParameters;
	};
};
