/* eslint-env jest */
if (expect.getState().testPath.endsWith('App.test.tsx')) {
  require('react-native-reanimated').setUpTests();
}
