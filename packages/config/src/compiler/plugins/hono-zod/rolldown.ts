import type { UnpluginInstance } from "unplugin";
import { unplugin } from "./index.ts";

const rolldown: UnpluginInstance<undefined>["rolldown"] = unplugin.rolldown;

export default rolldown;
