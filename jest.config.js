module.exports = {
  preset: '@react-native/jest-preset',
  roots: ['<rootDir>/src', '<rootDir>/__tests__', '<rootDir>/test'],
  resolver: 'react-native-reanimated/jest/resolver',
  setupFiles: ['./jest.setup.js'],
  setupFilesAfterEnv: ['./test/setupAnimations.js'],
  moduleNameMapper: { '\\.css$': '<rootDir>/test/mocks/styleMock.js' },
  transformIgnorePatterns: [
    'node_modules/(?!((@)?react-native|@react-native(-community)?|@react-navigation|react-native-.*|@react-native-async-storage)/)',
  ],
};
