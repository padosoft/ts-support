---
"@padosoft/zod-to-openapi-client": minor
"@padosoft/utilities": minor
---

Request params/body are now typed from zod **input** instead of output.

**@padosoft/utilities** — `ConvertMaybeZod` and `DeepConvertMaybeZod` gain an optional second type parameter `Mode extends ZodInferMode` (`"input" | "output" | "infer"`, default `"infer"` = output, so existing usage is unchanged). New exports `ZodInferMode` and `InferZod`.

**@padosoft/zod-to-openapi-client** — the request `parameters` and `requestBody` converters now use `ConvertMaybeZod<…, "input">`; the response converter keeps `"output"`. This means a request field declared with zod `.default()` is now **optional** on the generated client method (the caller may omit it — the server applies the default), instead of being incorrectly required. Responses are unaffected. Consumers no longer need per-call `as` casts to reconcile defaulted request params.
