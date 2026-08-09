import type { UnpluginInstance } from "unplugin";
import { unplugin } from "./index.ts";

const rspack: UnpluginInstance<undefined>["rspack"] = unplugin.rspack;

export default rspack;
