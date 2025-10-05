/**
 * Converts centimeters to feet and inches
 * @param cm - Height in centimeters
 * @returns Formatted string like "5' 7""
 */
export function cmToFeetInches(cm: number): string {
  if (!cm || cm <= 0) return '';
  
  // Convert cm to inches
  const totalInches = cm / 2.54;
  
  // Convert to feet and inches
  const feet = Math.floor(totalInches / 12);
  const inches = Math.ceil(totalInches % 12);
  
  // Handle edge case where inches rounds up to 12
  if (inches === 12) {
    return `${feet + 1}' 0"`;
  }
  
  return `${feet}' ${inches}"`;
}

/**
 * Formats height display with both metric and imperial units
 * @param cm - Height in centimeters
 * @returns Formatted string like "171cm / 5' 7""
 */
export function formatHeight(cm: number): string {
  if (!cm || cm <= 0) return 'Not available';
  
  const imperial = cmToFeetInches(cm);
  return `${cm}cm / ${imperial}`;
}
