// Public ListingController accepts integers including zero, through INT_MAX.
// Keep the pre-existing decimal/positive behavior isolated to demo mode.
export function validSearchWeight(value: string, demo: boolean) {
  const text = value.trim();
  if (!text) return true;
  return demo
    ? /^\d+(\.\d+)?$/.test(text) &&
        Number.isFinite(Number(text)) &&
        Number(text) > 0
    : /^\d+$/.test(text) && Number(text) <= 2147483647;
}
