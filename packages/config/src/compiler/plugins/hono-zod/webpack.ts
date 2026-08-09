import type { UnpluginInstance } from "unplugin";
import { unplugin } from "./index.ts";

const webpack: UnpluginInstance<undefined>["webpack"] = unplugin.webpack;

export default webpack;
