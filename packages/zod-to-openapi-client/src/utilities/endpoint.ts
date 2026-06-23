import type { RouteConfig } from "@asteasolutions/zod-to-openapi";
import type { MetaKeys } from "./constants";

type ApplyEndpointCollectionConfig<
	Endpoint extends RouteConfig,
	Config extends { path: string },
> = Omit<Endpoint, "path"> & {
	path: `${Config["path"]}${Endpoint["path"] extends "/" ? "" : Endpoint["path"]}`;
};

type EndpointTypes<T> = {
	Collections: keyof T;
	CollectionGraph: {
		[Collection in keyof T]: T[Collection] extends infer Operations
			? {
					[Operation in keyof Operations as Operation extends "config"
						? never
						: Operation]: Operations[Operation] extends RouteConfig
						? ApplyEndpointCollectionConfig<
								Operations[Operation],
								"config" extends keyof Operations
									? Operations["config"] extends { path: string }
										? Operations["config"]
										: never
									: never
							>
						: Operations[Operation];
				}
			: never;
	};
};

type CollectionMap<T> =
	EndpointTypes<T>["CollectionGraph"][EndpointTypes<T>["Collections"]];

export type Endpoints<T> =
	CollectionMap<T> extends infer Collection
		? Collection extends object
			? Collection[keyof Collection] extends infer Operation
				? Operation extends RouteConfig
					? Operation
					: never
				: never
			: never
		: never;

export type EndpointsMethods<T> = Endpoints<T>["method"];
export type EndpointsPaths<T> = Endpoints<T>["path"];

export type ExtractEndpointInfo<Endpoint extends RouteConfig> = {
	[K in MetaKeys as K extends keyof Endpoint ? K : never]: Endpoint[K];
};
