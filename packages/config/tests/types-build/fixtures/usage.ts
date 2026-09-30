// A consumer of the published (built) type entries.
import "@padosoft/config/types/nativewind";
import type { NativeTabIcon } from "@padosoft/config/types/expo-router";
import type {
	NativeStackHeaderItemButton,
	NativeStackHeaderItemMenu,
	NativeStackHeaderItemMenuAction,
	NativeStackNavigationOptions,
} from "expo-router/react-navigation";

// nativewind: `nativewind/types` is loaded.
export const nativewind: "loaded" = __nativewindTypes;

// expo-router: the react-navigation interfaces extend native-stack's.
export const options: NativeStackNavigationOptions = { fromNativeStack: true };
export const button: NativeStackHeaderItemButton = {
	buttonFromNativeStack: true,
};
export const menu: NativeStackHeaderItemMenu = { menuFromNativeStack: true };
export const action: NativeStackHeaderItemMenuAction = {
	actionFromNativeStack: true,
};
// @ts-expect-error not a native-stack option
export const unknownOption: NativeStackNavigationOptions = { nope: true };
export const icon: NativeTabIcon = { md: "home", sf: "house" };
