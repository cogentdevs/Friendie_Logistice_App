export const formatDate = (value: string | Date, locale = 'en-PK') =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(value),
  );
