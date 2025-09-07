import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";

export const listApps = (): string[] => {
	const dir = resolve(cwd(), "apps");
	return readdirSync(dir);
};

export const listPacakges = (): string[] => {
	const dir = resolve(cwd(), "packages");
	return readdirSync(dir);
};

export const fileNameValidator = (input: string): string | boolean => {
	if (input.includes(".")) {
		return "file name cannot include an extension";
	}

	if (input.includes(" ")) {
		return "file name cannot include spaces";
	}

	if (!input) {
		return "file name is required";
	}

	return true;
};
