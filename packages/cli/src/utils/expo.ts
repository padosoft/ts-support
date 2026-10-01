/** Whether an npm package belongs to the Expo SDK family (`expo`, `expo-*`, `@expo/*`, `*-expo`). */
export function isExpoPackage(name: string): boolean {
	return (
		name === "expo" ||
		name.startsWith("expo-") ||
		name.startsWith("@expo/") ||
		name.endsWith("-expo")
	);
}
