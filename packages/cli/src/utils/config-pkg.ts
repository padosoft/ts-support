import { createRequire } from "node:module";
import { dirname } from "node:path";

const _require = createRequire(import.meta.url);

export const configPkgDir = dirname(_require.resolve("@padosoft/config/package.json"));
