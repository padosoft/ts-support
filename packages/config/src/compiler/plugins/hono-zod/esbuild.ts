import type { UnpluginInstance } from "unplugin";
import { unplugin } from "./index.ts";

const esbuild: UnpluginInstance<undefined>["esbuild"] = unplugin.esbuild;

export default esbuild;
