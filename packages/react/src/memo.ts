import { memo } from "react";

export const genericMemo: <
	// biome-ignore lint/suspicious/noExplicitAny: required for HOC type inference — no other solution without losing prop assignability
	Component extends React.FunctionComponent<any>,
	Props = React.ComponentProps<Component>,
>(
	component: Component,
	propsAreEqual?: (
		prevProps: React.PropsWithChildren<Props>,
		nextProps: React.PropsWithChildren<Props>,
	) => boolean,
) => React.NamedExoticComponent<Props> = memo;
