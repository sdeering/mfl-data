export interface TierColors {
  bg: string; // Card fill
  fg: string; // Ink on the fill
  text: string; // The tier as a text colour on the page background (follows the theme)
}

/**
 * MFL card tier of a rating: Ultimate 95+, Legendary 85+, Rare 75+, Uncommon 65+, Limited 55+, Common below.
 */
export function getTierColors(rating: number): TierColors {
  if (rating >= 95) return { bg: '#86f0f2', fg: '#062022', text: 'var(--rt-cyan)' };
  if (rating >= 85) return { bg: '#ee5bf2', fg: '#2a0630', text: 'var(--rt-pink)' };
  if (rating >= 75) return { bg: '#2f5bff', fg: '#ffffff', text: 'var(--rt-blue)' };
  if (rating >= 65) return { bg: '#8ae63a', fg: '#0d1a05', text: 'var(--rt-green)' };
  if (rating >= 55) return { bg: '#e9cf86', fg: '#241c06', text: 'var(--rt-sand)' };
  return { bg: '#454d49', fg: '#e3e8e5', text: 'var(--rt-grey)' };
}
