import type {
	NativeStackHeaderItemButton as NativeStackHeaderItemButtonProps,
	NativeStackHeaderItemMenuAction as NativeStackHeaderItemMenuActionProps,
	NativeStackHeaderItemMenu as NativeStackHeaderItemMenuProps,
	NativeStackNavigationOptions as NativeStackProps,
} from "expo-router/build/react-navigation/native-stack";
import type { NativeTabs } from "expo-router/unstable-native-tabs";

declare module "expo-router/react-navigation" {
	interface NativeStackNavigationOptions extends NativeStackProps {}
	interface NativeStackHeaderItemButton
		extends NativeStackHeaderItemButtonProps {}
	interface NativeStackHeaderItemMenu extends NativeStackHeaderItemMenuProps {}
	interface NativeStackHeaderItemMenuAction
		extends NativeStackHeaderItemMenuActionProps {}
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
