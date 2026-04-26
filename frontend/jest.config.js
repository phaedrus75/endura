module.exports = {
  preset: 'jest-expo/web',
  setupFiles: ['<rootDir>/__tests__/setup.ts'],
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|posthog-react-native|lottie-react-native)'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],
  collectCoverageFrom: [
    'services/**/*.ts',
    'screens/**/*.tsx',
    'contexts/**/*.tsx',
    '!**/*.d.ts',
  ],
};
