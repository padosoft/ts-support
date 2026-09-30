// A namespace import, not aliased named imports: the declaration bundler drops
// the aliases, which turned each `extends` below into a self-reference.
import type * as NativeStack from "expo-router/build/react-navigation/native-stack";
import type { NativeTabs } from "expo-router/unstable-native-tabs";

declare module "expo-router/react-navigation" {
	interface NativeStackNavigationOptions
		extends NativeStack.NativeStackNavigationOptions {}
	interface NativeStackHeaderItemButton
		extends NativeStack.NativeStackHeaderItemButton {}
	interface NativeStackHeaderItemMenu
		extends NativeStack.NativeStackHeaderItemMenu {}
	interface NativeStackHeaderItemMenuAction
		extends NativeStack.NativeStackHeaderItemMenuAction {}
}

export interface NativeTabIcon
	extends Extract<
		Extract<
			React.ComponentProps<typeof NativeTabs.Trigger.Icon>,
			{
				md: unknown;
			}
		>,
		{
			sf?: unknown;
		}
	> {}
