/* eslint-env jest */
require('react-native-gesture-handler/jestSetup');
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map();
  return {
    getItem: jest.fn(async key => values.get(key) ?? null),
    setItem: jest.fn(async (key, value) => {
      values.set(key, value);
    }),
    removeItem: jest.fn(async key => {
      values.delete(key);
    }),
  };
});
jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device' },
}));
jest.mock('react-native-permissions', () =>
  require('react-native-permissions/mock'),
);
jest.mock('@react-native-firebase/app', () => ({ getApps: jest.fn(() => []) }));
jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(),
}));

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Icon = props => React.createElement(View, props);
  return Object.fromEntries(
    [
      'MessagesSquare',
      'LayoutDashboard',
      'List',
      'Camera',
      'CreditCard',
      'LogOut',
      'Paperclip',
      'Send',
      'CheckCheck',
      'Phone',
      'MoreVertical',
      'ImageOff',
      'Package',
      'PackageOpen',
      'Menu',
      'ArrowLeft',
      'ArrowRight',
      'Check',
      'Mail',
      'Search',
      'SlidersHorizontal',
      'Crosshair',
      'Globe2',
      'ChevronDown',
      'CalendarDays',
      'ChevronLeft',
      'ChevronRight',
      'ArrowDownUp',
      'History',
      'Plane',
      'ClipboardList',
      'LockKeyhole',
      'Eye',
      'EyeOff',
      'Home',
      'Plus',
      'MessageCircle',
      'MessageSquareText',
      'UserRound',
      'Heart',
      'Star',
      'Bell',
      'MapPin',
      'Settings',
      'CircleHelp',
      'ShieldAlert',
      'Clock',
      'Info',
    ].map(name => [name, Icon]),
  );
});

jest.mock('react-native-worklets', () =>
  require('react-native-worklets/src/mock'),
);

jest.mock('react-native-linear-gradient', () => ({
  __esModule: true,
  default: require('react-native').View,
}));

jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn((_success, failure) => failure({ code: 2 })),
  requestAuthorization: jest.fn(async () => 'denied'),
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(async () => ({ didCancel: true })),
  launchImageLibrary: jest.fn(async () => ({ didCancel: true })),
}));
