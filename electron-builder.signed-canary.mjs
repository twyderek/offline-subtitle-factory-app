import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSignedCanaryBuildConfig } from './lib/macos-signed-canary-build-config.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
export default loadSignedCanaryBuildConfig(appDir, {
  outputDirectory: process.env.OSF_SIGNED_CANARY_OUTPUT_DIR || null,
});
