// Function to get tier color based on rating value (same as PlayerStatsGrid)
export const getTierColor = (rating: number) => {
  if (rating >= 95) {
    return {
      bg: 'bg-[#87f6f8]',
      text: 'text-black',
      border: 'border-[var(--tier-common-foreground)]/15'
    };
  } else if (rating >= 85) {
    return {
      bg: 'bg-[#fa53ff]',
      text: 'text-white',
      border: 'border-[var(--tier-common-foreground)]/15'
    };
  } else if (rating >= 75) {
    return {
      bg: 'bg-[#0047ff]',
      text: 'text-white',
      border: 'border-[var(--tier-common-foreground)]/15'
    };
  } else if (rating >= 65) {
    return {
      bg: 'bg-[#71ff30]',
      text: 'text-black',
      border: 'border border-[#b9b9b9]'
    };
  } else if (rating >= 55) {
    return {
      bg: 'bg-[#ecd17f]',
      text: 'text-black',
      border: 'border-[var(--tier-common-foreground)]/15'
    };
  } else {
    return {
      bg: 'bg-[#9f9f9f]',
      text: 'text-white',
      border: 'border-[var(--tier-common-foreground)]/15'
    };
  }
};

// Helper function to get background color based on rating difference
export const getRatingStyle = (rating: number, _overallRating: number) => {
  if (!_overallRating) return 'bg-white dark:bg-gray-800';
  
  const difference = rating - _overallRating;
  
  // Bright green for same rating as overall and above
  if (difference >= 0) {
    return 'bg-[#7dffad]';
  }
  
  // Smooth transition from bright green to light red for -1 to -10
  if (difference >= -10) {
    // Use predefined color steps for better reliability
    if (difference >= -2) return 'bg-[#7dffad]'; // Bright green
    if (difference >= -4) return 'bg-[#9dffb3]'; // Slightly lighter green
    if (difference >= -6) return 'bg-[#bdffc9]'; // Light green
    if (difference >= -8) return 'bg-[#ddffdf]'; // Very light green
    return 'bg-[#f0fff2]'; // Almost white with green tint
  }
  
  // Lighter red for below -10, getting progressively darker but lighter than before
  if (difference >= -20) {
    if (difference >= -12) return 'bg-red-50'; // Very light red
    if (difference >= -14) return 'bg-red-100'; // Light red
    if (difference >= -16) return 'bg-red-200'; // Medium red
    if (difference >= -18) return 'bg-red-300'; // Darker red
    return 'bg-red-400'; // Dark red
  }
  
  // Darkest red for very low ratings (below -20) - also lighter
  return 'bg-red-300';
};

export const getRatingColors = (rating: number, overallRating: number) => {
  const tierColors = getTierColor(rating);
  return `${tierColors.text} ${tierColors.bg} ${tierColors.border}`;
};

