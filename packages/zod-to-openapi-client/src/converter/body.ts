import type {
	RouteConfig,
	ZodRequestBody,
} from "@asteasolutions/zod-to-openapi";
import type { ConvertMaybeZod } from "@padosoft/utilities";
import type { Endpoints } from "../utilities/endpoint";

interface RequestBodyContent<Body extends ZodRequestBody> {
	content: {
		"application/json": NonNullable<
			ConvertMaybeZod<
				NonNullable<NonNullable<Body["content"]>["application/json"]>["schema"]
			>
		>;
	};
}

export interface ConvertRequestBody<T, Endpoint extends Endpoints<T>> {
	requestBody?: Endpoint extends {
		request?: infer Request;
	}
		? Request extends RouteConfig["request"]
			? NonNullable<Request> extends {
					body?: infer Body;
				}
				? Body extends ZodRequestBody
					? Body["content"] extends undefined
						? never
						: NonNullable<Body["content"]>["application/json"] extends undefined
							? never
							: RequestBodyContent<Body>
					: never
				: never
			: never
		: never;
}
