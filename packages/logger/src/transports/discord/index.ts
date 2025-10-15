import { createTransport } from "@/lib/mods";
import type { LogEntry } from "@/types";
import type { Transport } from "@/types/mods";
import { httpTransport } from "../http";

export interface DiscordTransportOptions {
	webhookUrl: string;
}

export const discordTransport = (
	options: DiscordTransportOptions,
): Transport => {
	const http = httpTransport({
		endpoint: options.webhookUrl,
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		transformBody: (body: LogEntry[]) => {
			const message = {
				username: "Logger",
				embeds: [
					{
						title: "Log Entries",
						description: body
							.map(
								(entry) =>
									`**[${entry.level.toUpperCase()}]** ${entry.data.join(" ")}`,
							)
							.join("\n"),
						color: 5814783,
						timestamp: new Date().toISOString(),
						footer: {
							text: `Total Entries: ${body.length}`,
						},
					},
				],
			};

			return JSON.stringify(message);
		},
	});

	return createTransport({
		name: "discord",

		send(...args) {
			return http.send(...args);
		},

		batch(...args) {
			return http.batch?.(...args);
		},
	});
};
