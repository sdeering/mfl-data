/** A Flow address is 0x and 16 hex digits; the 0x may be left off. Returns it lower-cased, or null. */
export const normalizeWalletAddress = (input: string): string | null => {
  const trimmed = input.trim().toLowerCase();
  const withPrefix = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  return /^0x[0-9a-f]{16}$/.test(withPrefix) ? withPrefix : null;
};
