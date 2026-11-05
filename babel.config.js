module.exports = api => {
  const test = api.env('test');
  return {
    presets: test
      ? ['module:@react-native/babel-preset']
      : [
          [
            'module:@react-native/babel-preset',
            { jsxImportSource: 'nativewind' },
          ],
          'nativewind/babel',
        ],
    plugins: [
      '@babel/plugin-transform-export-namespace-from',
      'react-native-worklets/plugin',
    ],
  };
};
