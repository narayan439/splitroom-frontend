import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const configuredApiUrl = process.env.RENDER_BACKEND_URL?.trim();

if (!configuredApiUrl) {
  console.error('RENDER_BACKEND_URL must be set to the deployed HTTPS API URL.');
  process.exit(1);
}

let apiUrl;
try {
  const parsedUrl = new URL(configuredApiUrl);
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('The API URL must use HTTPS.');
  }
  if (parsedUrl.pathname !== '/' || parsedUrl.search || parsedUrl.hash) {
    throw new Error('RENDER_BACKEND_URL must be the API origin without a path.');
  }
  apiUrl = parsedUrl.toString().replace(/\/+$/, '');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'RENDER_BACKEND_URL is invalid.');
  process.exit(1);
}

const build = spawnSync(
  process.execPath,
  [
    join(projectRoot, 'node_modules', '@angular', 'cli', 'bin', 'ng.js'),
    'build',
    '--configuration',
    'production',
  ],
  { cwd: projectRoot, stdio: 'inherit' },
);

if (build.error) {
  console.error('Could not start the Angular production build.', build.error);
  process.exit(1);
}
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const runtimeConfigPath = join(
  projectRoot,
  'dist',
  'splitroom-frontend',
  'browser',
  'runtime-config.js',
);
writeFileSync(
  runtimeConfigPath,
  `window.__SPLITROOM_CONFIG__ = ${JSON.stringify({ apiUrl })};\n`,
  'utf8',
);
console.log(`Wrote production API configuration for ${new URL(apiUrl).host}.`);
