const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withNativeWind } = require('nativewind/metro');
const defaults = getDefaultConfig(__dirname);
// Native build trees contain many generated files that Metro never needs to watch.
const nativeTrees = ['android', 'ios', '.validation'].map(name => {
  const escaped = path
    .join(__dirname, name)
    .split(path.sep)
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\\\/]');
  return new RegExp('^' + escaped + '[\\\\/]');
});
const previous = defaults.resolver.blockList;
const blockList = [
  ...(Array.isArray(previous) ? previous : previous ? [previous] : []),
  ...nativeTrees,
  // Autolinked libraries generate large native trees which are never JS inputs.
  /[\\/]node_modules[\\/].+[\\/](?:android[\\/](?:build|\.cxx)|ios[\\/]build)[\\/]/,
];
const config = mergeConfig(defaults, { resolver: { blockList } });
module.exports = withNativeWind(config, { input: './global.css' });
