---
"@padosoft/logger": patch
---

Mark `expo-application` as an optional peer dependency (like `expo-file-system`) and relax its version pin from `57.0.2` to `*`.

Both peers are only required by the optional `@padosoft/logger/transports/expo-fs` transport. Previously `expo-application` was a required peer pinned to a single patch version, forcing every consumer — including non-Expo runtimes like Cloudflare Workers that only import the core logger — to resolve the entire Expo/Metro/React Native dependency graph into their lockfile. It is now consistent with `expo-file-system`: optional and unpinned.
