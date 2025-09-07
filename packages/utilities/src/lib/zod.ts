import type * as z from "zod/v4/core";
import { prettifyError } from "zod/v4/core";

export interface FormattedZodError {
	code: string;
	message: string;
}

export const formatZodError = (
	error: z.$ZodError,
): Readonly<FormattedZodError> => {
	const issue = error.issues[0];

	if (!issue) {
		return {
			code: "UNKNOWN",
			message: "Unknown issue",
		} as const;
	}

	return {
		code: issue.code.toUpperCase(),
		message: prettifyError(error),
	} as const;
};
