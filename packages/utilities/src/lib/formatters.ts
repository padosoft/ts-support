export const createCurrencyFormatter = (
	currency = "EUR",
	locale?: string,
): Intl.NumberFormat =>
	new Intl.NumberFormat(locale, { style: "currency", currency });
