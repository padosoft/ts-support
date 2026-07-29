# @padosoft/openapi-client

A typed base client for [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) with middleware support, error handling, and a clean extension model.

## Installation

```bash
npm install @padosoft/openapi-client openapi-fetch openapi-typescript-helpers
```

## Generating typed paths

`OpenApiClient` is generic over a `Paths` type that describes your API surface. The easiest way to produce this type is with [openapi-typescript](https://openapi-ts.dev), which converts any OpenAPI 3.0/3.1 schema into TypeScript without requiring Java or a running server.

```bash
# From a local schema file
npx openapi-typescript ./path/to/schema.yaml -o ./src/api/schema.d.ts

# From a remote schema
npx openapi-typescript https://myapi.dev/api/v1/openapi.yaml -o ./src/api/schema.d.ts
```

Pass the generated type as the `Paths` generic when extending `OpenApiClient`:

```ts
import { OpenApiClient } from "@padosoft/openapi-client";
import type { paths } from "./src/api/schema.d.ts";

class MyApiClient extends OpenApiClient<paths> {
  getUser(id: string) {
    return this.wrapFetchCall(
      this.client.GET("/users/{id}", { params: { path: { id } } }),
    );
  }
}

const client = new MyApiClient({ baseUrl: "https://myapi.dev" });
const user = await client.getUser("123");
```

## Middleware

The client supports four middleware types that hook into different stages of the request lifecycle.

### Inline registration

For simple cases, use the shorthand methods directly on the client instance:

```ts
client.onRequest(({ request }) => {
  request.headers.set("Authorization", `Bearer ${getToken()}`);
});

client.onResponse(({ request, response }) => {
  console.log(`${request.method} ${response.status}`);
});

client.onError(({ request, error }) => {
  console.error("Network failure:", error);
});

client.onResponseError(({ response, error }) => {
  console.error(`${response.status}:`, error.message);
});
```

### `createMiddleware` — named, reusable middleware

`OpenApiClient.createMiddleware()` creates a named middleware object that can be registered with `client.use()` and later removed with `client.eject()`. The name also appears in devtools.

```ts
import {
  OpenApiClient,
  type ClientMiddlewareFunctionParameters,
} from "@padosoft/openapi-client";

const authMiddleware = OpenApiClient.createMiddleware({
  name: "auth-bearer",
  type: "onRequest",
  middleware: async ({ request }: ClientMiddlewareFunctionParameters<"onRequest">) => {
    const token = await getAuthToken();
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
  },
});

client.use(authMiddleware);
```

#### Parameters

`createMiddleware` accepts a single `CreateClientMiddlewareOptions<K, N>` object:

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `ClientMiddlewareType` | yes | When the middleware fires (see table below) |
| `name` | `string` | no | Unique identifier. Defaults to `type` if omitted — only one middleware per type allowed without an explicit name |
| `middleware` | `(params) => ...` | yes | The callback function |

#### Middleware types

| Type | When it fires | Callback receives | Can return |
|---|---|---|---|
| `onRequest` | Before the fetch call | `{ request, schemaPath, params, options, id, client }` | `void`, modified `Request`, or `Response` (short-circuit) |
| `onResponse` | After a response (any status) | `{ request, response, schemaPath, params, options, id, client }` | `void` or modified `Response` |
| `onError` | On network error / abort | `{ request, error, schemaPath, params, options, id, client }` | `void`, `Error`, or `Response` (recovery) |
| `onResponseError` | On HTTP 4xx/5xx (custom, fired by `wrapFetchCall`) | `{ response, error, client }` | `void` |

`onRequest`, `onResponse`, and `onError` are native [openapi-fetch middleware](https://openapi-ts.dev/openapi-fetch/middleware-auth). `onResponseError` is a custom type fired internally by `wrapFetchCall()` when the response status is >= 400.

#### Typed `client` access

By default the `client` field in callback params is `unknown`. To access your client's methods and properties inside the middleware, annotate the callback parameter with `ClientMiddlewareFunctionParameters`:

```ts
import type { ClientMiddlewareFunctionParameters } from "@padosoft/openapi-client";

// Replace `MyApiClient` with your actual client class
type OnRequestParams = ClientMiddlewareFunctionParameters<"onRequest", MyApiClient>;

const loggingMiddleware = OpenApiClient.createMiddleware({
  name: "request-logger",
  type: "onRequest",
  middleware: async ({ request, schemaPath, client }: OnRequestParams) => {
    // `client` is typed as MyApiClient — full access to its public API
    const config = client.configuration;
    console.log(`[${config?.baseUrl}] ${request.method} ${schemaPath}`);
  },
});
```

#### Registration and removal

```ts
// Register
client.use(authMiddleware);

// Remove by name
client.eject("auth-bearer");
```

Calling `use()` with a middleware whose name already exists replaces the previous one.

#### Multiple middleware of the same type

Each name must be unique. Multiple middleware of the same type (e.g. two `onRequest` handlers) work fine as long as they have different names:

```ts
const corsMiddleware = OpenApiClient.createMiddleware({
  name: "cors-headers",
  type: "onRequest",
  middleware: async ({ request }) => {
    request.headers.set("X-Requested-With", "openapi-client");
  },
});

const authMiddleware = OpenApiClient.createMiddleware({
  name: "auth-bearer",
  type: "onRequest",
  middleware: async ({ request }) => {
    request.headers.set("Authorization", `Bearer ${getToken()}`);
  },
});

client.use(corsMiddleware);
client.use(authMiddleware); // both fire on every request
```

If `name` is omitted, it defaults to the `type` — registering a second unnamed middleware of the same type replaces the first.

## Sharing a client instance

Pass an existing `openapi-fetch` client to share it across multiple service classes:

```ts
import createClient from "openapi-fetch";
import type { paths } from "./schema.d.ts";

const shared = createClient<paths>({ baseUrl: "https://myapi.dev" });

const users = new UsersService(shared);
const posts = new PostsService(shared);
// middleware registered on `shared` fires for both
```
