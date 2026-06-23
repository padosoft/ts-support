# @padosoft/zod-to-openapi-client

Converts [`@asteasolutions/zod-to-openapi`](https://github.com/asteasolutions/zod-to-openapi) route collections into a typed `Paths` object compatible with [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) and [`@padosoft/openapi-client`](../openapi-client).

Use this package when your API is defined with `zod-to-openapi` and you want full end-to-end type safety without running `openapi-typescript` against a schema file.

## Installation

```bash
npm install @padosoft/zod-to-openapi-client
# peer dependencies
npm install @asteasolutions/zod-to-openapi @padosoft/utilities
```

## Usage

```ts
import type { CreateClientPaths } from "@padosoft/zod-to-openapi-client";
import { OpenApiClient } from "@padosoft/openapi-client";
import { myRouteCollection } from "./routes";

// Derive typed Paths from your route collections
type MyPaths = CreateClientPaths<typeof myRouteCollection>;

// Pass the Paths type to OpenApiClient
class MyApiClient extends OpenApiClient<MyPaths> {
  getUser(id: string) {
    return this.wrapFetchCall(
      this.client.GET("/users/{id}", { params: { path: { id } } }),
    );
  }
}
```

### Custom error response

Pass a typed error schema as the second generic to get typed error responses across all endpoints:

```ts
interface ApiError extends ResponseConfig {
  content: { "application/json": { schema: z.ZodObject<{ message: z.ZodString }> } };
  description: "Error";
}

type MyPaths = CreateClientPaths<typeof myRouteCollection, ApiError>;
```

## Utility types

```ts
import type {
  GetEndpoint,
  GetSpecEndpoint,
  Endpoints,
  EndpointsMethods,
  EndpointsPaths,
  HttpMethod,
} from "@padosoft/zod-to-openapi-client";
```

| Type | Description |
|------|-------------|
| `GetEndpoint<TCollections, TPath, TMethod>` | Extract a single endpoint definition |
| `GetSpecEndpoint<TCollections, TPath, TMethod>` | Extract a spec-level endpoint (before conversion) |
| `Endpoints<TCollections>` | All endpoint definitions |
| `EndpointsMethods<TCollections, TPath>` | HTTP methods available for a given path |
| `EndpointsPaths<TCollections>` | Union of all path strings |
| `HttpMethod` | `"get" \| "post" \| "put" \| "patch" \| "delete" \| ...` |
