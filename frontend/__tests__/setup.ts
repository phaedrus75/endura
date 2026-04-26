// Jest setup — mock Expo modules that require native code
// Note: @testing-library/jest-native/extend-expect is loaded via setupFilesAfterEach
// at this stage jest globals (expect) are already available.

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'ExponentPushToken[testtoken123]' })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('notification-id')),
}));

// Mock expo-device
jest.mock('expo-device', () => ({
  isDevice: true,
  deviceName: 'Test Device',
  modelName: 'iPhone Test',
  osVersion: '16.0',
}));

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock expo-font
jest.mock('expo-font', () => ({
  loadAsync: jest.fn(() => Promise.resolve()),
  isLoaded: jest.fn(() => true),
}));

// Mock posthog-react-native
jest.mock('posthog-react-native', () => ({
  PostHog: jest.fn().mockImplementation(() => ({
    capture: jest.fn(),
    identify: jest.fn(),
    screen: jest.fn(),
    reset: jest.fn(),
  })),
  usePostHog: jest.fn(() => ({
    capture: jest.fn(),
    identify: jest.fn(),
    screen: jest.fn(),
  })),
}));

// Mock sentry
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (c: any) => c,
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  withScope: jest.fn(),
}));

// Silence act() warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
