// Stand-in for the global `React` namespace of @types/react.
declare namespace React {
	type ComponentProps<T> = T extends (props: infer P) => unknown ? P : never;
}
