import type React from "react";

// biome-ignore lint/suspicious/noExplicitAny: required for HOC type to be usable in composeHOCs
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

export function getComponentName<P>(
	Component: React.ComponentType<P>,
	fallback = "Component",
): string {
	return Component.displayName || Component.name || fallback;
}

/**
 * Augments a provider-like component with a `.wrap` method that wraps
 * another component inside it, avoiding manual JSX nesting.
 *
 * @example
 * const ProviderComponent = withWrap(OriginalProvider);
 * const WrappedApp = ProviderComponent.wrap(App);
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
 * Attaches `.create(props?)` and `.asComponent(props?)` factory helpers
 * to a React component.
 *
 * @example
 * const Layout = withCreate((props: { title: string }) => <h1>{props.title}</h1>);
 * Layout.create({ title: "Hello" }); // => <Layout title="Hello" />
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
 * Wraps a component with an array of providers, outermost first.
 *
 * @example
 * const WrappedApp = wrapProviders([ProviderA, ProviderB])(App);
 * // => <ProviderA><ProviderB><App /></ProviderB></ProviderA>
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
 * Composes multiple HOCs onto a component, applied right-to-left
 * (last HOC is innermost wrapper).
 *
 * @example
 * const Enhanced = composeHOCs(MyComponent)(withCreate, memo, Provider.wrap);
 * // => withCreate(memo(Provider.wrap(MyComponent)))
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
