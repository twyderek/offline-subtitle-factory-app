import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectSignedCanaryArtifacts } from '../lib/macos-signed-canary-artifact-selection.mjs';

const scriptPath = fileURLToPath(import.meta.url);

function main() {
  const outputDirectory = process.argv[2] || '';
  if (!outputDirectory) throw new Error('SIGNED_CANARY_OUTPUT_DIRECTORY_REQUIRED');
  console.log(JSON.stringify(selectSignedCanaryArtifacts(path.resolve(outputDirectory))));
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();
