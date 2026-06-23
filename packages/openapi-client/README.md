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

```ts
client.onRequest(({ request }) => {
  request.headers.set("Authorization", `Bearer ${getToken()}`);
});

client.onResponseError(({ response, error }) => {
  console.error(`${response.status}:`, error.message);
});
```

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
