module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      files: ['scripts/**/*.cjs'],
      env: { node: true, es2022: true },
      parserOptions: { ecmaVersion: 2022, sourceType: 'script' },
    },
  ],
  rules: {
    'react/no-unstable-nested-components': ['warn', { allowAsProps: true }],
  },
};
