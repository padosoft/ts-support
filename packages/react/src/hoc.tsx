// biome-ignore lint/suspicious/noExplicitAny: Any is necessary for the HOC type definition to be used in composeHOCs function
export type HOC<P extends object = any> = (
	Component: React.ComponentType<P>,
) => React.ComponentType<P>;

type ExtractExtras<T, P = object> = T extends React.ComponentType<P> & infer E
	? E
	: never;

type ApplyHOCs<
	P extends object,
	C extends React.ComponentType<P>,
	Hs extends readonly unknown[],
> = Hs extends readonly []
	? C
	: Hs extends readonly [...infer Rest, infer Last]
		? Last extends (component: infer I) => infer O
			? C extends I
				? O extends React.ComponentType<P>
					? ApplyHOCs<P, O & ExtractExtras<C, React.ComponentProps<O>>, Rest>
					: never
				: never
			: never
		: never;

type CreateComponentArgs<P extends object> = keyof P extends never
	? []
	: [props: P];
/**
 * Returns a human-readable name for a React component.
 *
 * It prioritizes:
 * 1. `displayName` (explicitly set, most reliable)
 * 2. `name` (function or class name)
 * 3. a fallback string (`"Component"`)
 *
 * @example
 * const MyComponent = () => null;
 * getComponentName(MyComponent); // "MyComponent"
 * @example
 * const Wrapped = React.memo(() => null);
 * getComponentName(Wrapped); // "Component" (fallback, unless displayName is set)
 *
 * @param Component - The component to extract the name from
 * @param fallback - Optional fallback name (default: "Component")
 * @returns The resolved component name
 */
export function getComponentName<P>(
	Component: React.ComponentType<P>,
	fallback = "Component",
): string {
	return Component.displayName || Component.name || fallback;
}

/**
 * Enhances a provider-like component by adding a `.wrap` helper,
 * which wraps another component inside it.
 *
 * This is useful for composing context providers or layout wrappers
 * around arbitrary components without manually nesting JSX.
 *
 * @example
 * const ProviderComponent = withWrap(OriginalProviderComponent);
 *
 * const WrappedApp = ProviderComponent.wrap(App);
 *
 * // Equivalent to:
 * const WrappedApp = (props) => (
 *   <OriginalProviderComponent>
 *     <App {...props} />
 *   </OriginalProviderComponent>
 * );
 *
 * @param Component - A React function component that requires `children`
 * @returns The original component augmented with a `.wrap` method
 * @remarks
 * The generated component will have a composed `displayName` for easier debugging.
 */
export const withWrap = (
	Component: React.ComponentType<React.PropsWithChildren>,
): React.ComponentType<{
	children?: React.ReactNode | undefined;
}> & {
	wrap: <P extends object>(C: React.ComponentType<P>) => React.ComponentType<P>;
} => {
	return Object.assign(Component, {
		wrap: <P extends object>(
			C: React.ComponentType<P>,
		): React.ComponentType<P> => {
			const Wrapped = (props: P) => (
				<Component>
					<C {...props} />
				</Component>
			);

			Wrapped.displayName = `${getComponentName(Component, "Wrapped")}(${getComponentName(C)})`;

			return Wrapped;
		},
	});
};

/**
 * Enhances a React function component by attaching factory helpers:
 * - `.create(props?)` returns a JSX element of the component
 * - `.asComponent(props?)` returns a component factory function that renders it
 *
 * @param Component - React function component to enhance
 * @returns The same component with added static helpers:
 * - `create(props?: P): JSX.Element`
 * - `asComponent(props?: P): React.FC`
 *
 * @example
 * const Layout = withCreate((props: { title: string }) => {
 *   return <h1>{props.title}</h1>;
 * });
 *
 * Layout.create({ title: "Hello" });
 * // => <Layout title="Hello" />
 *
 * const RenderLayout = Layout.asComponent({ title: "Hi" });
 * // => () => <Layout title="Hi" />
 */
export const withCreate = <P extends object>(
	Component: React.ComponentType<P>,
): React.ComponentType<P> & {
	create: (...args: CreateComponentArgs<P>) => React.JSX.Element;
	asComponent: (...args: CreateComponentArgs<P>) => () => React.JSX.Element;
} => {
	const create = (...args: CreateComponentArgs<P>) => {
		const props = (args[0] ?? {}) as P;
		return <Component {...props} />;
	};

	return Object.assign(Component, {
		create,

		asComponent: (...args: CreateComponentArgs<P>) => {
			return () => create(...args);
		},
	});
};

/**
 * Utility to wrap a component with multiple providers in a clean and composable way.
 * The providers will be applied from right to left, meaning the last provider in the array will be the innermost wrapper, and the first provider will be the outermost wrapper.
 *
 * @example
 * const providers = [ProviderA, ProviderB, ProviderC];
 * const WrappedApp = wrapProviders(providers)(App);
 *
 * // Which is equivalent to:
 * const WrappedApp = (props) => (
 *   <ProviderA>
 *     <ProviderB>
 *       <ProviderC>
 *         <App {...props} />
 *       </ProviderC>
 *     </ProviderB>
 *   </ProviderA>
 * );
 *
 * @param providers - An array of provider components (components that accept `children`)
 * @returns A higher-order component that wraps the given component with all the specified providers
 */
export const wrapProviders = (
	providers: React.ComponentType<React.PropsWithChildren>[],
) => {
	return <P extends object>(
		Component: React.ComponentType<P>,
	): React.ComponentType<P> => {
		const Wrapped = (props: P) => {
			return providers.reduceRight(
				(children, Provider) => (
					<Provider key={getComponentName(Provider)}>{children}</Provider>
				),
				<Component {...props} />,
			);
		};

		Wrapped.displayName = `Wrapped(${getComponentName(Component)})`;

		return Wrapped;
	};
};

/**
 * Creates a higher-order component (HOC) composer for a given React component.
 *
 * HOCs are composed from right to left (using `reduceRight`), meaning:
 * - The last HOC provided is applied first and becomes the innermost wrapper.
 * - The first HOC provided is applied last and becomes the outermost wrapper.
 *
 * @example
 * const enhanceComponent = composeHOCs<MyComponentProps>(MyComponent);
 * const EnhancedComponent = enhanceComponent(
 * 	withCreate<MyComponentProps>,
 * 	memo<React.ComponentType<MyComponentProps>>,
 * 	Providers.wrap
 * );
 *
 * // Which is equivalent to:
 * const EnhancedComponent = withCreate(memo(Providers.wrap(MyComponent)));
 *
 * @param hocs - An array of higher-order components (functions that take a component and return an enhanced component)
 * @returns A function that takes a component and applies all the HOCs to it in sequence
 */
export const composeHOCs =
	<P extends object>(Component: React.ComponentType<P>) =>
	<Hs extends readonly HOC[]>(
		...hocs: Hs
	): ApplyHOCs<P, React.ComponentType<P>, Hs> =>
		hocs.reduceRight((acc, hoc) => hoc(acc), Component) as ApplyHOCs<
			P,
			React.ComponentType<P>,
			Hs
		>;
