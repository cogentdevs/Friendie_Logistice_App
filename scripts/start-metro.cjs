const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const project = path.resolve(__dirname, '..');
function normalized(folder) {
  const resolved = path.resolve(folder);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}
function probeMetro(port, root = project) {
  return new Promise((resolve, reject) => {
    const request = http.get(
      { hostname: '127.0.0.1', port, path: '/status', timeout: 8000 },
      response => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', chunk => {
          body += chunk;
        });
        response.on('end', () => {
          const serverRoot = response.headers['x-react-native-project-root'];
          if (
            response.statusCode === 200 &&
            body.trim() === 'packager-status:running' &&
            typeof serverRoot === 'string' &&
            normalized(serverRoot) === normalized(root)
          )
            resolve(true);
          else
            reject(
              new Error(
                'Port ' +
                  port +
                  ' belongs to another server/project. Close that server before starting Friendie Metro.',
              ),
            );
        });
      },
    );
    request.on('timeout', () =>
      request.destroy(
        new Error(
          'Port ' +
            port +
            ' is occupied but Metro is not responding. Restart its existing terminal.',
        ),
      ),
    );
    request.on('error', error =>
      error.code === 'ECONNREFUSED' ? resolve(false) : reject(error),
    );
  });
}
async function main() {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 8081;
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('Invalid Metro port');
  if (await probeMetro(port)) {
    if (args.length)
      throw new Error(
        'Friendie Metro is already running. Stop its terminal before applying new startup flags.',
      );
    console.log(
      'Friendie Metro is already running at http://localhost:' +
        port +
        '. Reusing it; no second server started.',
    );
    console.log('Run npm run android in your app terminal.');
    return;
  }
  const cli = path.join(project, 'node_modules/react-native/cli.js');
  if (!fs.existsSync(cli))
    throw new Error('React Native CLI is missing. Run npm ci first.');
  const child = spawn(
    process.execPath,
    [cli, 'start', '--port', String(port), '--max-workers', '2', ...args],
    { cwd: project, stdio: 'inherit' },
  );
  child.on('error', error => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 130 : 0);
  });
  process.once('SIGINT', () => child.kill('SIGINT'));
  process.once('SIGTERM', () => child.kill('SIGTERM'));
}
module.exports = { probeMetro };
if (require.main === module)
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
