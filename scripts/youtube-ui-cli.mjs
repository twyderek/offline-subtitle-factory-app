import fs from 'node:fs';
import path from 'node:path';

export function parseNativeTarget(args) {
  const installedCount = args.filter((arg) => arg === '--installed-native').length;
  const sourceCount = args.filter((arg) => arg === '--source-native').length;
  const candidateArgs = args.filter((arg) => arg.startsWith('--candidate-native'));

  if (args.some((arg) => (arg.startsWith('--installed-native') && arg !== '--installed-native')
    || (arg.startsWith('--source-native') && arg !== '--source-native'))) {
    throw new Error('Installed/source native target flags do not accept values; use the exact flag.');
  }
  if (candidateArgs.length > 1) throw new Error('Specify --candidate-native only once.');
  if (installedCount > 1) throw new Error('Specify --installed-native only once.');
  if (sourceCount > 1) throw new Error('Specify --source-native only once.');
  if (args.some((arg) => arg.startsWith('--candidate-native') && !arg.startsWith('--candidate-native='))) {
    throw new Error('Candidate target must use --candidate-native=<.app path>.');
  }
  const supportedFlags = new Set([
    '--installed-native', '--source-native', '--validate-usability', '--usability', '--compare-installed', '--validate-layout',
  ]);
  if (args.some((arg) => arg.startsWith('-') && !supportedFlags.has(arg) && !arg.startsWith('--candidate-native='))) {
    throw new Error('Unknown command-line option.');
  }
  if (args.some((arg) => !arg.startsWith('-'))) throw new Error('Unexpected positional command-line argument.');
  if (installedCount + sourceCount + candidateArgs.length > 1) {
    throw new Error('Choose only one native runtime target.');
  }
  if (candidateArgs.length) {
    const candidateValue = candidateArgs[0].slice('--candidate-native='.length);
    if (!candidateValue) throw new Error('Candidate app bundle path is required.');
    return { nativeVersion: 'candidate', candidateAppPath: path.resolve(candidateValue) };
  }
  if (installedCount) return { nativeVersion: 'installed', candidateAppPath: null };
  if (sourceCount) return { nativeVersion: 'source', candidateAppPath: null };
  return { nativeVersion: null, candidateAppPath: null };
}

function lstatOrThrow(targetPath, message) {
  try {
    return fs.lstatSync(targetPath);
  } catch {
    throw new Error(message);
  }
}

function assertDirectory(targetPath, label) {
  if (!lstatOrThrow(targetPath, `Candidate ${label} directory is missing.`).isDirectory()) {
    throw new Error(`Candidate ${label} must be a directory, not a file or symlink.`);
  }
}

function assertInsideBundle(bundlePath, targetPath, label) {
  const realBundlePath = fs.realpathSync(bundlePath);
  const realTargetPath = fs.realpathSync(targetPath);
  const relativePath = path.relative(realBundlePath, realTargetPath);
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    throw new Error(`Candidate ${label} resolves outside the .app bundle.`);
  }
}

export function validateCandidateApp(candidateAppPath) {
  if (!candidateAppPath.endsWith('.app')) throw new Error('Candidate must be an unpacked macOS .app bundle.');
  const bundle = lstatOrThrow(candidateAppPath, 'Candidate .app bundle does not exist.');
  if (!bundle.isDirectory()) throw new Error('Candidate .app bundle must be a directory, not a file or symlink.');

  const contentsPath = path.join(candidateAppPath, 'Contents');
  const resourcesPath = path.join(contentsPath, 'Resources');
  const appRoot = path.join(resourcesPath, 'app');
  const macOSPath = path.join(contentsPath, 'MacOS');
  assertDirectory(contentsPath, 'Contents');
  assertDirectory(resourcesPath, 'Contents/Resources');
  assertDirectory(appRoot, 'app resources');
  assertDirectory(macOSPath, 'Contents/MacOS');

  const packagePath = path.join(appRoot, 'package.json');
  if (!lstatOrThrow(packagePath, 'Candidate app package.json is missing.').isFile()) {
    throw new Error('Candidate app package.json must be a regular file.');
  }
  assertInsideBundle(candidateAppPath, packagePath, 'package.json');

  const executable = path.join(macOSPath, '離線字幕工廠');
  const executableStat = lstatOrThrow(executable, 'Candidate executable is missing.');
  if (!executableStat.isFile()) throw new Error('Candidate executable must be a regular file.');
  assertInsideBundle(candidateAppPath, executable, 'executable');
  if (process.platform !== 'win32' && (executableStat.mode & 0o111) === 0) {
    throw new Error('Candidate executable has no execute permission bits.');
  }
  try {
    fs.accessSync(executable, fs.constants.X_OK);
  } catch {
    throw new Error('Candidate executable is not executable by the current user.');
  }
  return { candidateAppRoot: appRoot, candidateExecutable: executable };
}
