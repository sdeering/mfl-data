/**
 * Get the Overall line color for the progression graph based on the player's overall rating
 * Uses the same color system as the Overall rating cards
 */
export const getOverallLineColor = (overall: number): string => {
  if (overall >= 95) {
    return '#86f0f2'; // Ultimate - cyan
  } else if (overall >= 85) {
    return '#ee5bf2'; // Legendary - magenta/purple
  } else if (overall >= 75) {
    return '#2f5bff'; // Rare/Epic - blue
  } else if (overall >= 65) {
    return '#8ae63a'; // Uncommon - green
  } else if (overall >= 55) {
    return '#e9cf86'; // Limited - gold/yellow
  } else {
    return '#9f9f9f'; // Common - gray
  }
};
