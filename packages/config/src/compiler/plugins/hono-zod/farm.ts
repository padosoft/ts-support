import type { UnpluginInstance } from "unplugin";
import { unplugin } from "./index.ts";

const farm: UnpluginInstance<undefined>["farm"] = unplugin.farm;

export default farm;
