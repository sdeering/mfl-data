/**
 * Responsive Typography System
 * 
 * This file defines a comprehensive typography scale that works across all themes
 * and device sizes, ensuring consistent readability and visual hierarchy.
 */

export const typography = {
  // Font families
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'Consolas', 'monospace'],
  },

  // Font sizes with responsive scaling
  fontSize: {
    // Display sizes - for hero sections and major headings
    'display-2xl': {
      base: '4.5rem',    // 72px
      sm: '5rem',        // 80px
      lg: '6rem',        // 96px
    },
    'display-xl': {
      base: '3.75rem',   // 60px
      sm: '4.5rem',      // 72px
      lg: '5rem',        // 80px
    },
    'display-lg': {
      base: '3rem',      // 48px
      sm: '3.75rem',     // 60px
      lg: '4rem',        // 64px
    },
    'display-md': {
      base: '2.25rem',   // 36px
      sm: '2.5rem',      // 40px
      lg: '3rem',        // 48px
    },
    'display-sm': {
      base: '1.875rem',  // 30px
      sm: '2rem',        // 32px
      lg: '2.25rem',     // 36px
    },
    'display-xs': {
      base: '1.5rem',    // 24px
      sm: '1.75rem',     // 28px
      lg: '2rem',        // 32px
    },

    // Heading sizes - for section headings and page titles
    'heading-xl': {
      base: '1.25rem',   // 20px
      sm: '1.5rem',      // 24px
      lg: '1.75rem',     // 28px
    },
    'heading-lg': {
      base: '1.125rem',  // 18px
      sm: '1.25rem',     // 20px
      lg: '1.5rem',      // 24px
    },
    'heading-md': {
      base: '1rem',      // 16px
      sm: '1.125rem',    // 18px
      lg: '1.25rem',     // 20px
    },
    'heading-sm': {
      base: '0.875rem',  // 14px
      sm: '1rem',        // 16px
      lg: '1.125rem',    // 18px
    },
    'heading-xs': {
      base: '0.75rem',   // 12px
      sm: '0.875rem',    // 14px
      lg: '1rem',        // 16px
    },

    // Body text sizes - for content and UI elements
    'body-xl': {
      base: '1.125rem',  // 18px
      sm: '1.25rem',     // 20px
      lg: '1.375rem',    // 22px
    },
    'body-lg': {
      base: '1rem',      // 16px
      sm: '1.125rem',    // 18px
      lg: '1.25rem',     // 20px
    },
    'body-md': {
      base: '0.875rem',  // 14px
      sm: '1rem',        // 16px
      lg: '1.125rem',    // 18px
    },
    'body-sm': {
      base: '0.75rem',   // 12px
      sm: '0.875rem',    // 14px
      lg: '1rem',        // 16px
    },
    'body-xs': {
      base: '0.625rem',  // 10px
      sm: '0.75rem',     // 12px
      lg: '0.875rem',    // 14px
    },

    // Special sizes for specific use cases
    'label-lg': {
      base: '0.875rem',  // 14px
      sm: '1rem',        // 16px
      lg: '1.125rem',    // 18px
    },
    'label-md': {
      base: '0.75rem',   // 12px
      sm: '0.875rem',    // 14px
      lg: '1rem',        // 16px
    },
    'label-sm': {
      base: '0.625rem',  // 10px
      sm: '0.75rem',     // 12px
      lg: '0.875rem',    // 14px
    },

    // Player rating sizes - for MFL-specific components
    'rating-xl': {
      base: '1.5rem',    // 24px
      sm: '1.75rem',     // 28px
      lg: '2rem',        // 32px
    },
    'rating-lg': {
      base: '1.25rem',   // 20px
      sm: '1.5rem',      // 24px
      lg: '1.75rem',     // 28px
    },
    'rating-md': {
      base: '1rem',      // 16px
      sm: '1.125rem',    // 18px
      lg: '1.25rem',     // 20px
    },
    'rating-sm': {
      base: '0.875rem',  // 14px
      sm: '1rem',        // 16px
      lg: '1.125rem',    // 18px
    },
  },

  // Line heights for optimal readability
  lineHeight: {
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },

  // Font weights
  fontWeight: {
    thin: '100',
    extralight: '200',
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },

  // Letter spacing
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
} as const;

/**
 * Typography utility classes for Tailwind CSS
 * These can be used directly in className props
 */
export const typographyClasses = {
  // Display text
  'display-2xl': 'text-6xl sm:text-7xl lg:text-8xl font-bold tracking-tight',
  'display-xl': 'text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight',
  'display-lg': 'text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight',
  'display-md': 'text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight',
  'display-sm': 'text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight',
  'display-xs': 'text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight',

  // Headings
  'heading-xl': 'text-lg sm:text-xl lg:text-2xl font-semibold tracking-tight',
  'heading-lg': 'text-base sm:text-lg lg:text-xl font-semibold tracking-tight',
  'heading-md': 'text-sm sm:text-base lg:text-lg font-semibold tracking-tight',
  'heading-sm': 'text-xs sm:text-sm lg:text-base font-semibold tracking-tight',
  'heading-xs': 'text-xs sm:text-sm lg:text-base font-medium tracking-tight',

  // Body text
  'body-xl': 'text-base sm:text-lg lg:text-xl font-normal leading-relaxed',
  'body-lg': 'text-sm sm:text-base lg:text-lg font-normal leading-relaxed',
  'body-md': 'text-xs sm:text-sm lg:text-base font-normal leading-relaxed',
  'body-sm': 'text-xs sm:text-sm lg:text-base font-normal leading-normal',
  'body-xs': 'text-xs sm:text-xs lg:text-sm font-normal leading-normal',

  // Labels
  'label-lg': 'text-xs sm:text-sm lg:text-base font-medium tracking-wide uppercase',
  'label-md': 'text-xs sm:text-xs lg:text-sm font-medium tracking-wide uppercase',
  'label-sm': 'text-xs sm:text-xs lg:text-xs font-medium tracking-wide uppercase',

  // Player ratings
  'rating-xl': 'text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight',
  'rating-lg': 'text-lg sm:text-xl lg:text-2xl font-bold tracking-tight',
  'rating-md': 'text-base sm:text-lg lg:text-xl font-bold tracking-tight',
  'rating-sm': 'text-sm sm:text-base lg:text-lg font-bold tracking-tight',
} as const;

/**
 * Theme-aware text colors
 */
export const textColors = {
  // Primary text colors
  primary: 'text-gray-900 dark:text-white',
  secondary: 'text-gray-600 dark:text-gray-300',
  tertiary: 'text-gray-500 dark:text-gray-400',
  muted: 'text-gray-400 dark:text-gray-500',
  
  // Accent colors
  accent: 'text-blue-600 dark:text-blue-400',
  accentHover: 'text-blue-700 dark:text-blue-300',
  
  // Status colors
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  error: 'text-red-600 dark:text-red-400',
  info: 'text-blue-600 dark:text-blue-400',
  
  // Interactive colors
  interactive: 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300',
  interactiveSecondary: 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white',
} as const;

/**
 * Combined typography and color classes
 */
export const textStyles = {
  // Page titles
  pageTitle: `${typographyClasses['display-sm']} ${textColors.primary}`,
  
  // Section headings
  sectionHeading: `${typographyClasses['heading-lg']} ${textColors.primary}`,
  subsectionHeading: `${typographyClasses['heading-md']} ${textColors.primary}`,
  
  // Body text
  bodyLarge: `${typographyClasses['body-lg']} ${textColors.primary}`,
  bodyMedium: `${typographyClasses['body-md']} ${textColors.primary}`,
  bodySmall: `${typographyClasses['body-sm']} ${textColors.secondary}`,
  
  // Labels and captions
  label: `${typographyClasses['label-md']} ${textColors.secondary}`,
  caption: `${typographyClasses['body-xs']} ${textColors.tertiary}`,
  
  // Interactive elements
  link: `${typographyClasses['body-md']} ${textColors.interactive}`,
  button: `${typographyClasses['body-md']} font-medium`,
  
  // Player-specific
  playerName: `${typographyClasses['heading-md']} ${textColors.interactive}`,
  playerId: `${typographyClasses['body-sm']} ${textColors.tertiary}`,
  playerRating: `${typographyClasses['rating-lg']} ${textColors.primary}`,
  playerAttribute: `${typographyClasses['rating-md']} ${textColors.primary}`,
  
  // Table headers
  tableHeader: `${typographyClasses['label-md']} ${textColors.secondary}`,
  tableCell: `${typographyClasses['body-sm']} ${textColors.primary}`,
} as const;

/**
 * Responsive typography hook for dynamic sizing
 */
export const useResponsiveTypography = () => {
  return {
    // Get responsive font size based on breakpoint
    getFontSize: (size: keyof typeof typography.fontSize, breakpoint: 'base' | 'sm' | 'lg' = 'base') => {
      return typography.fontSize[size][breakpoint];
    },
    
    // Get complete typography class
    getTypographyClass: (variant: keyof typeof typographyClasses) => {
      return typographyClasses[variant];
    },
    
    // Get text style with color
    getTextStyle: (style: keyof typeof textStyles) => {
      return textStyles[style];
    },
  };
};
