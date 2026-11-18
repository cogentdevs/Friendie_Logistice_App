// Public-only normalized Home DTO. Never use this key for customer data.
export const publicHomeKey = ['home', 'latest', 'api'] as const;
export function isPublicHomeQuery(query: { queryKey: readonly unknown[] }) {
  return (
    query.queryKey.length === publicHomeKey.length &&
    publicHomeKey.every((value, index) => query.queryKey[index] === value)
  );
}
