const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const project = path.resolve(__dirname, '..');
const hash = value =>
  crypto.createHash('sha256').update(value).digest('hex').slice(0, 10);
const cache = path.join(
  os.tmpdir(),
  'friendie-native-' + hash(project.toLowerCase()),
);
function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith('..' + path.sep) &&
    !path.isAbsolute(relative)
  );
}
async function exists(file) {
  try {
    return await fs.lstat(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
async function inventory(folder) {
  let files = 0,
    bytes = 0;
  for (const item of await fs.readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, item.name);
    if (item.isSymbolicLink())
      throw new Error(
        'Refusing to migrate a build tree containing a link: ' + file,
      );
    if (item.isDirectory()) {
      const nested = await inventory(file);
      files += nested.files;
      bytes += nested.bytes;
    } else {
      files++;
      bytes += (await fs.stat(file)).size;
    }
  }
  return { files, bytes };
}
async function attachBuild({
  workspace,
  cacheRoot,
  source,
  key,
  migrate = false,
  dryRun = false,
  log = console.log,
}) {
  workspace = await fs.realpath(workspace);
  source = path.resolve(source);
  if (!inside(workspace, source) || path.basename(source) !== 'build')
    throw new Error('Unsafe generated build path: ' + source);
  const parent = await fs.realpath(path.dirname(source));
  if (!inside(workspace, parent))
    throw new Error('Build parent leaves workspace: ' + source);
  const family = path.join(cacheRoot, key);
  if (!inside(cacheRoot, family)) throw new Error('Unsafe cache key');
  const entry = await exists(source);
  if (entry?.isSymbolicLink()) {
    const destination = path.resolve(await fs.readlink(source));
    if (!inside(cacheRoot, destination))
      throw new Error('Refusing to replace an external build link: ' + source);
    if (inside(family, destination)) {
      if (!dryRun) await fs.mkdir(destination, { recursive: true });
      return { migratedBytes: 0, linked: false };
    }
    if (dryRun) {
      log('Would switch generated cache: ' + source);
      return { migratedBytes: 0, linked: false };
    }
    const target = path.join(family, 'build');
    await fs.mkdir(target, { recursive: true });
    await fs.unlink(source); // Remove only the junction, never its target.
    try {
      await fs.symlink(target, source, 'junction');
    } catch (error) {
      await fs.symlink(destination, source, 'junction');
      throw error;
    }
    return { migratedBytes: 0, linked: true };
  }
  if (entry && !entry.isDirectory())
    throw new Error('Build path is not a directory: ' + source);
  const populated = entry && (await fs.readdir(source)).length > 0;
  if (populated && !migrate && !dryRun)
    throw new Error(
      'Existing generated outputs need migration. With Gradle idle, run npm run android:cache.',
    );
  const target = path.join(
    family,
    populated ? 'b-' + Date.now().toString(36) : 'build',
  );
  if (dryRun) {
    log('Generated build: ' + source + ' -> ' + target);
    return { migratedBytes: 0, linked: false };
  }
  await fs.mkdir(target, { recursive: true });
  let bytes = 0;
  if (populated) {
    log('Copying generated outputs: ' + path.relative(workspace, source));
    const before = await inventory(source);
    await fs.cp(source, target, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
    const copied = await inventory(target);
    if (before.files !== copied.files || before.bytes !== copied.bytes)
      throw new Error(
        'Generated output copy verification failed; original preserved: ' +
          source,
      );
    bytes = before.bytes;
    // Both absolute paths are checked before the recursive move/delete.
    const backupRoot = path.join(
      workspace,
      '.validation',
      'native-build-backups',
    );
    const backup = path.join(backupRoot, key + '-' + Date.now());
    if (!inside(workspace, backup) || !inside(cacheRoot, target))
      throw new Error('Unsafe migration destination');
    await fs.mkdir(backupRoot, { recursive: true });
    await fs.rename(source, backup);
    try {
      await fs.symlink(target, source, 'junction');
    } catch (error) {
      await fs.rename(backup, source);
      throw error;
    }
    const resolvedBackup = await fs.realpath(backup);
    if (
      !inside(workspace, resolvedBackup) ||
      !inside(backupRoot, resolvedBackup)
    )
      throw new Error('Unsafe backup cleanup path');
    await fs.rm(resolvedBackup, { recursive: true });
  } else {
    if (entry) await fs.rmdir(source); // An empty, checked build directory only.
    await fs.symlink(target, source, 'junction');
  }
  log('Native cache linked: ' + path.relative(workspace, source));
  return { migratedBytes: bytes, linked: true };
}
async function main() {
  if (process.platform !== 'win32') {
    console.log(
      'Windows native-cache junctions are not needed on this platform.',
    );
    return;
  }
  const dryRun = process.argv.includes('--dry-run');
  const migrate = process.argv.includes('--migrate');
  const manifest = JSON.parse(
    await fs.readFile(path.join(project, 'package.json'), 'utf8'),
  );
  const rn = JSON.parse(
    await fs.readFile(
      path.join(project, 'node_modules/react-native/package.json'),
      'utf8',
    ),
  ).version;
  const candidates = [
    {
      source: path.join(project, 'android/app/build'),
      name: 'app',
      version: manifest.version,
    },
    {
      source: path.join(project, 'android/build'),
      name: 'root',
      version: manifest.version,
    },
  ];
  for (const name of Object.keys(manifest.dependencies)) {
    const base = path.join(project, 'node_modules', ...name.split('/'));
    if ((await exists(path.join(base, 'android')))?.isDirectory()) {
      const version = JSON.parse(
        await fs.readFile(path.join(base, 'package.json'), 'utf8'),
      ).version;
      candidates.push({
        source: path.join(base, 'android/build'),
        name,
        version,
      });
    }
  }
  if (!dryRun) await fs.mkdir(cache, { recursive: true });
  let bytes = 0,
    linked = 0;
  for (const candidate of candidates) {
    const key =
      candidate.name.replace(/[^a-z0-9-]/gi, '_').slice(-18) +
      '-' +
      hash(candidate.name + candidate.version + rn);
    const result = await attachBuild({
      workspace: project,
      cacheRoot: cache,
      source: candidate.source,
      key,
      migrate,
      dryRun,
    });
    bytes += result.migratedBytes;
    linked += Number(result.linked);
  }
  console.log('Android generated-build cache: ' + cache);
  console.log(
    'New links: ' +
      linked +
      '; moved off project drive: ' +
      (bytes / 1073741824).toFixed(2) +
      ' GB',
  );
}
module.exports = { attachBuild, inside, inventory };
if (require.main === module)
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
