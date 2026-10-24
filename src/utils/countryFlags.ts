/**
 * Country name utilities for MFL player nationalities
 */

/**
 * Format country name for display by removing underscores and capitalizing properly
 */
export const formatCountryName = (country: string): string => {
  if (!country) return '';
  
  // Replace underscores with spaces and capitalize each word
  return country
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};
