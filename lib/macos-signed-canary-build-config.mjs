import fs from 'node:fs';
import path from 'node:path';

export function loadSignedCanaryBuildConfig(appDir, options = {}) {
  const manifest = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
  const build = structuredClone(manifest.build || {});
  const mac = { ...(build.mac || {}) };
  delete mac.identity;
  mac.hardenedRuntime = true;
  mac.gatekeeperAssess = true;
  build.mac = mac;
  if (options.outputDirectory !== undefined && options.outputDirectory !== null) {
    if (typeof options.outputDirectory !== 'string' || !path.isAbsolute(options.outputDirectory)) {
      throw new Error('Signed canary output directory must be an absolute path.');
    }
    const outputDirectory = path.resolve(options.outputDirectory);
    const resolvedAppDir = path.resolve(appDir);
    if (outputDirectory === resolvedAppDir || outputDirectory.startsWith(`${resolvedAppDir}${path.sep}`)) {
      throw new Error('Signed canary output directory must be outside the source tree.');
    }
    build.directories = { ...(build.directories || {}), output: outputDirectory };
  }
  return build;
}
