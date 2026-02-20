// Endura Color Theme - Nature-inspired with ocean & sky tones
export const colors = {
  // Primary palette
  background: '#E7EFEA',          // Mist Sage
  surface: '#FFFFFF',             // Pure white for cards
  surfaceAlt: '#E7EFEA',          // Mist Sage for alt surfaces

  // Brand colors
  primary: '#5F8C87',             // Ocean Sage - main brand
  primaryDark: '#3B5466',         // Navy - pressed/dark states
  primaryLight: '#A8C8D8',        // Light Blue - lighter variant
  secondary: '#7C8F86',           // Stone Fog
  tertiary: '#5F8C87',            // Ocean Sage for eco/actions

  // Accent colors
  accent: '#3B5466',              // Navy
  coral: '#A8C8D8',               // Light Blue
  mint: '#A9BDAF',                // Moss Grey

  // New palette colors
  navy: '#3B5466',                // Deep ocean navy
  lightBlue: '#A8C8D8',          // Morning sky blue
  driftwood: '#8B7D6B',          // Warm driftwood (subtle accent)

  // Rarity colors
  common: '#A9BDAF',              // Moss Grey
  rare: '#5F8C87',                // Ocean Sage
  epic: '#3B5466',                // Navy
  legendary: '#2F4A3E',           // Deep Pine

  // Text - Dark on light
  textPrimary: '#2F4A3E',         // Deep Pine
  textSecondary: '#5F8C87',       // Ocean Sage
  textMuted: '#7C8F86',           // Stone Fog
  textOnPrimary: '#FFFFFF',       // White text on primary buttons

  // Status
  success: '#5F8C87',             // Ocean Sage
  warning: '#3B5466',             // Navy
  error: '#B85C4A',               // Earthy red

  // Streaks
  streakActive: '#3B5466',        // Navy
  streakInactive: '#A8C8D8',      // Light Blue

  // Timer
  timerActive: '#5F8C87',         // Ocean Sage
  timerPaused: '#3B5466',         // Navy
  timerComplete: '#5F8C87',       // Ocean Sage

  // Nature theme elements
  grass: '#5F8C87',               // Ocean Sage
  grassLight: '#A8C8D8',          // Light Blue
  grassDark: '#3B5466',           // Navy
  sky: '#A8C8D8',                 // Light Blue
  hills: '#A9BDAF',               // Moss Grey

  // Card styling
  cardBorder: '#A9BDAF',          // Moss Grey
  divider: '#A9BDAF',             // Moss Grey

  // Gradients
  gradientPrimary: ['#5F8C87', '#3B5466'],
  gradientBackground: ['#E7EFEA', '#A9BDAF'],
  gradientEgg: ['#FDFEFE', '#E7EFEA'],
  gradientGold: ['#5F8C87', '#3B5466'],
  gradientNature: ['#A8C8D8', '#5F8C87'],
  gradientSky: ['#E7EFEA', '#A8C8D8'],
  gradientNavy: ['#3B5466', '#2F4A3E'],
  gradientOcean: ['#A8C8D8', '#5F8C87'],
  gradientFrost: ['#FFFFFF', '#E7EFEA'],
};

export const shadows = {
  small: {
    shadowColor: '#3B5466',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#3B5466',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#3B5466',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 8,
  },
  soft: {
    shadowColor: '#5F8C87',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
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
