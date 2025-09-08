import type { Mod, Plugin, Transport } from "@/types/mods";

export const createPlugin = <P extends Omit<Plugin, keyof Mod<string>>>(
	options: P,
): Plugin => {
	return {
		...options,
		_tag: "plugin",
	} as const;
};

export const createTransport = <T extends Omit<Transport, keyof Mod<string>>>(
	options: T,
): Transport => {
	return {
		...options,
		_tag: "transport",
	} as const;
};
