// Compatibility shims for two requested libraries that still publish pre-AGP-8 manifests.
// Keep changes narrow and repeatable after npm ci; no manual native linking.
const fs = require('fs');
for (const [name, namespace] of [
  ['react-native-geolocation-service', 'com.agontuk.RNFusedLocation'],
  ['react-native-linear-gradient', 'com.BV.LinearGradient'],
]) {
  const base = 'node_modules/' + name + '/android/';
  const originalGradle = fs.readFileSync(base + 'build.gradle', 'utf8');
  let gradle = originalGradle;
  if (!/namespace\s/.test(gradle))
    gradle = gradle.replace(
      'android {',
      'android {\n    namespace "' + namespace + '"',
    );
  if (gradle !== originalGradle)
    fs.writeFileSync(base + 'build.gradle', gradle);
  const manifest = base + 'src/main/AndroidManifest.xml';
  const originalManifest = fs.readFileSync(manifest, 'utf8');
  const updatedManifest = originalManifest.replace(/\s+package="[^"]+"/, '');
  if (updatedManifest !== originalManifest)
    fs.writeFileSync(manifest, updatedManifest);
}
console.log(
  'Applied AGP namespace compatibility for geolocation and linear-gradient.',
);
