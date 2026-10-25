/** A player ID on its own (a # in front is fine), or out of a link to a player here or on mfl.com. Null for anything else. */
export const playerIdFromText = (text: string): string | null => {
  const trimmed = text.trim();
  return trimmed.match(/^#?(\d+)$/)?.[1] ?? trimmed.match(/\/players\/(\d+)/)?.[1] ?? null;
};
