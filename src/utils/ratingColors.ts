/**
 * Rating color utilities for MFL player ratings
 * 
 * Color scheme:
 * - 85+ rating: rgb(250, 83, 255) (purple/magenta)
 * - 75+ rating: rgb(22, 159, 237) (blue) 
 * - 65+ rating: rgb(58, 242, 75) (green)
 * - 55+ rating: rgb(255, 204, 0) (yellow/gold)
 * - Under 55: rgb(159, 159, 159) (gray)
 */

export interface RatingColorScheme {
  textColor: string;
  bgColor: string;
  borderColor: string;
  barColor: string;
  rgbColor: string;
}

export const getRatingColors = (rating?: number): RatingColorScheme => {
  if (!rating || rating < 55) {
    return {
      textColor: 'text-gray-500',
      bgColor: 'bg-gray-100',
      borderColor: 'border-gray-300',
      barColor: 'bg-gray-400',
      rgbColor: 'rgb(159, 159, 159)',
    };
  }

  if (rating >= 85) {
    return {
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-100',
      borderColor: 'border-purple-300',
      barColor: 'bg-purple-500',
      rgbColor: 'rgb(250, 83, 255)',
    };
  }

  if (rating >= 75) {
    return {
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-300',
      barColor: 'bg-blue-500',
      rgbColor: 'rgb(22, 159, 237)',
    };
  }

  if (rating >= 65) {
    return {
      textColor: 'text-green-600',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-300',
      barColor: 'bg-green-500',
      rgbColor: 'rgb(58, 242, 75)',
    };
  }

  // 55-64 range
  return {
    textColor: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-300',
    barColor: 'bg-yellow-500',
    rgbColor: 'rgb(255, 204, 0)',
  };
};

/**
 * Get inline style with exact RGB color for precise color matching
 */
export const getRatingStyle = (rating?: number): { color: string } => {
  const colors = getRatingColors(rating);
  return { color: colors.rgbColor };
};

/**
 * Get background inline style with exact RGB color
 */
export const getRatingBgStyle = (rating?: number, opacity: number = 0.1): { backgroundColor: string } => {
  const colors = getRatingColors(rating);
  // Convert rgb to rgba with opacity
  const rgbValues = colors.rgbColor.match(/\d+/g);
  if (rgbValues) {
    return { backgroundColor: `rgba(${rgbValues.join(', ')}, ${opacity})` };
  }
  return { backgroundColor: colors.rgbColor };
};

/**
 * Get bar style for progress bars using exact RGB colors
 */
export const getRatingBarStyle = (rating?: number): { backgroundColor: string } => {
  const colors = getRatingColors(rating);
  return { backgroundColor: colors.rgbColor };
};
