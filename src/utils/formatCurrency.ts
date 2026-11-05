export const formatCurrency = (
  value: number,
  currency = 'PKR',
  locale = 'en-PK',
) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
