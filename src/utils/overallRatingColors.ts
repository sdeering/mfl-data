/**
 * Get the Overall line color for the progression graph based on the player's overall rating
 * Uses the same color system as the Overall rating cards
 */
export const getOverallLineColor = (overall: number): string => {
  if (overall >= 95) {
    return '#87f6f8'; // Ultimate - cyan
  } else if (overall >= 85) {
    return '#fa53ff'; // Legendary - magenta/purple
  } else if (overall >= 75) {
    return '#0047ff'; // Rare/Epic - blue
  } else if (overall >= 65) {
    return '#71ff30'; // Uncommon - green
  } else if (overall >= 55) {
    return '#ecd17f'; // Limited - gold/yellow
  } else {
    return '#9f9f9f'; // Common - gray
  }
};
