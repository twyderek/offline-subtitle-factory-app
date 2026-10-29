import fs from 'node:fs';
import path from 'node:path';

function readDirectory(directoryPath) {
  try {
    return fs.readdirSync(directoryPath, { withFileTypes: true });
  } catch {
    throw new Error('SIGNED_CANARY_OUTPUT_DIRECTORY_UNAVAILABLE');
  }
}

export function selectSignedCanaryArtifacts(outputDirectory) {
  if (typeof outputDirectory !== 'string' || !path.isAbsolute(outputDirectory)) {
    throw new Error('SIGNED_CANARY_OUTPUT_DIRECTORY_INVALID');
  }

  const resolvedOutputDirectory = path.resolve(outputDirectory);
  const macArm64Directory = path.join(resolvedOutputDirectory, 'mac-arm64');
  const appEntries = readDirectory(macArm64Directory)
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('.app'))
    .map((entry) => entry.name)
    .sort();
  const dmgEntries = readDirectory(resolvedOutputDirectory)
    .filter((entry) => entry.isFile() && /-macos-arm64\.dmg$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const zipEntries = readDirectory(resolvedOutputDirectory)
    .filter((entry) => entry.isFile() && /-macos-arm64\.zip$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  if (appEntries.length !== 1) throw new Error('SIGNED_CANARY_MAIN_APP_CARDINALITY_INVALID');
  if (dmgEntries.length !== 1) throw new Error('SIGNED_CANARY_DMG_CARDINALITY_INVALID');
  if (zipEntries.length !== 1) throw new Error('SIGNED_CANARY_ZIP_CARDINALITY_INVALID');

  return {
    appPath: path.join(macArm64Directory, appEntries[0]),
    dmgPath: path.join(resolvedOutputDirectory, dmgEntries[0]),
    zipPath: path.join(resolvedOutputDirectory, zipEntries[0]),
  };
}
