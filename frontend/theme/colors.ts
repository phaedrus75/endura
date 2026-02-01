// Endura Color Theme - Light nature-inspired for focus & calm
export const colors = {
  // Primary palette - Light & Natural
  background: '#F5F8F5',        // Soft off-white with green tint
  surface: '#FFFFFF',           // Pure white for cards
  surfaceAlt: '#EDF2ED',        // Slightly darker surface
  
  // Brand colors - Sage/Teal nature tones
  primary: '#6B9B9B',           // Sage teal - main brand color
  primaryDark: '#5A8585',       // Darker sage for pressed states
  primaryLight: '#8FB5B5',      // Lighter sage for backgrounds
  secondary: '#7BA3A3',         // Secondary teal
  tertiary: '#D4A84B',          // Golden amber for coins
  
  // Accent colors
  accent: '#E8B86D',            // Warm gold accent
  coral: '#E8A598',             // Soft coral for hearts/eggs
  mint: '#A8D5BA',              // Mint green
  
  // Rarity colors
  common: '#8FBF9F',            // Soft sage green
  rare: '#7EC8E3',              // Sky blue
  epic: '#B794D4',              // Soft purple
  legendary: '#E8B86D',         // Gold
  
  // Text - Dark on light
  textPrimary: '#2D3B36',       // Dark forest green
  textSecondary: '#5A6B65',     // Medium gray-green
  textMuted: '#8A9A94',         // Light gray-green
  textOnPrimary: '#FFFFFF',     // White text on primary buttons
  
  // Status
  success: '#6BBF8A',
  warning: '#E8B86D',
  error: '#D97B7B',
  
  // Streaks
  streakActive: '#E8A035',
  streakInactive: '#D4DDD8',
  
  // Timer
  timerActive: '#6B9B9B',
  timerPaused: '#E8B86D',
  timerComplete: '#6BBF8A',
  
  // Nature theme elements
  grass: '#7CB87F',
  grassLight: '#A8D4AA',
  grassDark: '#5A9A5C',
  sky: '#B8D4E3',
  hills: '#9FC5A8',
  
  // Card styling
  cardBorder: '#E2EAE5',
  divider: '#E8EDE9',
  
  // Gradients (as arrays for LinearGradient)
  gradientPrimary: ['#6B9B9B', '#5A8585'],
  gradientBackground: ['#F5F8F5', '#E8EDE9'],
  gradientEgg: ['#FDFEFE', '#F0F4F1'],
  gradientGold: ['#E8B86D', '#D4A84B'],
  gradientNature: ['#A8D5BA', '#7CB87F'],
  gradientSky: ['#D4E8F0', '#B8D4E3'],
};

export const shadows = {
  small: {
    shadowColor: '#2D3B36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#2D3B36',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#2D3B36',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 8,
  },
  soft: {
    shadowColor: '#6B9B9B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  }),
};

export const fonts = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};
