import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseNativeTarget, validateCandidateApp } from './youtube-ui-cli.mjs';

const expectError = (action, pattern) => assert.throws(action, pattern);
assert.deepEqual(parseNativeTarget([]), { nativeVersion: null, candidateAppPath: null });
assert.equal(parseNativeTarget(['--installed-native']).nativeVersion, 'installed');
assert.equal(parseNativeTarget(['--source-native']).nativeVersion, 'source');
expectError(() => parseNativeTarget(['--installed-native', '--installed-native']), /only once/);
expectError(() => parseNativeTarget(['--source-native', '--source-native']), /only once/);
expectError(() => parseNativeTarget(['--source-native', '--installed-native']), /only one/);
expectError(() => parseNativeTarget(['--candidate-native=/tmp/one.app', '--candidate-native=/tmp/two.app']), /only once/);
expectError(() => parseNativeTarget(['--candidate-native=/tmp/one.app', '--source-native']), /only one/);
expectError(() => parseNativeTarget(['--candidate-native']), /must use/);
expectError(() => parseNativeTarget(['--candidate-native=']), /path is required/);
expectError(() => parseNativeTarget(['--candidate-native-typo=/tmp/one.app']), /must use/);
expectError(() => parseNativeTarget(['--installed-native=typo']), /do not accept values/);
expectError(() => parseNativeTarget(['--source-native=typo']), /do not accept values/);
expectError(() => parseNativeTarget(['--installed-native-typo']), /do not accept values/);
expectError(() => parseNativeTarget(['--instaled-native']), /Unknown command-line option/);
expectError(() => parseNativeTarget(['--sorce-native']), /Unknown command-line option/);
expectError(() => parseNativeTarget(['--unrecognized-option']), /Unknown command-line option/);
expectError(() => parseNativeTarget(['-x']), /Unknown command-line option/);
expectError(() => parseNativeTarget(['unexpected-positional-argument']), /Unexpected positional/);
assert.equal(parseNativeTarget(['--validate-usability', '--usability', '--compare-installed', '--validate-layout']).nativeVersion, null);
const unusualPath = path.join(os.tmpdir(), 'candidate=fixture.app');
assert.equal(parseNativeTarget([`--candidate-native=${unusualPath}`]).candidateAppPath, path.resolve(unusualPath));

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'youtube-ui-cli-test-'));
function makeBundle(name, { packageFile = true, executableFile = true, executableMode = 0o755 } = {}) {
  const bundle = path.join(tempRoot, name);
  const appRoot = path.join(bundle, 'Contents', 'Resources', 'app');
  fs.mkdirSync(appRoot, { recursive: true });
  fs.mkdirSync(path.join(bundle, 'Contents', 'MacOS'), { recursive: true });
  if (packageFile) fs.writeFileSync(path.join(appRoot, 'package.json'), '{}');
  if (executableFile) {
    const executable = path.join(bundle, 'Contents', 'MacOS', '離線字幕工廠');
    fs.writeFileSync(executable, '#!/bin/sh\nexit 0\n');
    fs.chmodSync(executable, executableMode);
  }
  return bundle;
}

function makeBundleWithDirectorySymlink(name, component) {
  const external = makeBundle(`external-${name}`);
  const bundle = path.join(tempRoot, name);
  const contents = path.join(bundle, 'Contents');
  if (component === 'Contents') {
    fs.mkdirSync(bundle);
    fs.symlinkSync(path.join(external, 'Contents'), contents, 'dir');
    return bundle;
  }
  fs.mkdirSync(contents, { recursive: true });
  if (component === 'Resources') {
    fs.symlinkSync(path.join(external, 'Contents', 'Resources'), path.join(contents, 'Resources'), 'dir');
    return bundle;
  }
  if (component === 'app') {
    const resources = path.join(contents, 'Resources');
    fs.mkdirSync(resources, { recursive: true });
    fs.symlinkSync(path.join(external, 'Contents', 'Resources', 'app'), path.join(resources, 'app'), 'dir');
    return bundle;
  }
  const appRoot = path.join(contents, 'Resources', 'app');
  fs.mkdirSync(appRoot, { recursive: true });
  fs.writeFileSync(path.join(appRoot, 'package.json'), '{}');
  fs.symlinkSync(path.join(external, 'Contents', 'MacOS'), path.join(contents, 'MacOS'), 'dir');
  return bundle;
}

try {
  const validBundle = makeBundle('valid=fixture.app');
  assert.deepEqual(validateCandidateApp(validBundle), {
    candidateAppRoot: path.join(validBundle, 'Contents', 'Resources', 'app'),
    candidateExecutable: path.join(validBundle, 'Contents', 'MacOS', '離線字幕工廠'),
  });
  const fileBundle = path.join(tempRoot, 'not-a-directory.app');
  fs.writeFileSync(fileBundle, 'not a bundle');
  expectError(() => validateCandidateApp(fileBundle), /must be a directory/);
  expectError(() => validateCandidateApp(path.join(tempRoot, 'missing.app')), /does not exist/);
  expectError(() => validateCandidateApp(path.join(tempRoot, 'wrong.zip')), /\.app bundle/);
  expectError(() => validateCandidateApp(makeBundle('missing-package.app', { packageFile: false })), /package\.json is missing/);
  expectError(() => validateCandidateApp(makeBundle('missing-executable.app', { executableFile: false })), /executable is missing/);
  if (process.platform !== 'win32') {
    expectError(() => validateCandidateApp(makeBundle('not-executable.app', { executableMode: 0o644 })), /no execute permission/);
    for (const component of ['Contents', 'Resources', 'app', 'MacOS']) {
      const symlinkBundle = makeBundleWithDirectorySymlink(`external-${component.toLowerCase()}.app`, component);
      expectError(() => validateCandidateApp(symlinkBundle), /must be a directory, not a file or symlink/);
    }
  }

  const verifier = fileURLToPath(new URL('./verify-youtube-ui.mjs', import.meta.url));
  for (const [name, args, expected] of [
    ['duplicate-target', ['--source-native', '--source-native'], /only once/],
    ['assigned-installed-target', ['--installed-native=typo'], /do not accept values/],
    ['misspelled-installed-target', ['--instaled-native'], /Unknown command-line option/],
    ['misspelled-source-target', ['--sorce-native'], /Unknown command-line option/],
    ['unknown-short-option', ['-x'], /Unknown command-line option/],
    ['malformed-candidate', [`--candidate-native=${fileBundle}`], /must be a directory/],
    ...(process.platform === 'win32' ? [] : ['Contents', 'Resources', 'app', 'MacOS'].map((component) => {
      const symlinkBundle = makeBundleWithDirectorySymlink(`integration-external-${component.toLowerCase()}.app`, component);
      return [`${component}-symlink`, [`--candidate-native=${symlinkBundle}`], /must be a directory, not a file or symlink/];
    })),
  ]) {
    const screenshot = path.join(tempRoot, `${name}.png`);
    const profilesBefore = fs.readdirSync(tempRoot).filter((entry) => entry.startsWith('youtube-ui-smoke-')).sort();
    const result = spawnSync(process.execPath, [verifier, screenshot, ...args], {
      encoding: 'utf8', env: { ...process.env, TMPDIR: tempRoot },
    });
    assert.equal(result.status, 1, `${name} must fail before launching the app.`);
    assert.match(`${result.stdout}\n${result.stderr}`, expected);
    assert.equal(fs.existsSync(screenshot), false, `${name} must fail before creating evidence.`);
    assert.deepEqual(fs.readdirSync(tempRoot).filter((entry) => entry.startsWith('youtube-ui-smoke-')).sort(), profilesBefore,
      `${name} must fail before creating a user-data profile.`);
  }
  const profilesBeforeOptionFirst = fs.readdirSync(tempRoot).filter((entry) => entry.startsWith('youtube-ui-smoke-')).sort();
  const optionFirst = spawnSync(process.execPath, [verifier, '--source-native'], {
    cwd: tempRoot, encoding: 'utf8', env: { ...process.env, TMPDIR: tempRoot },
  });
  assert.equal(optionFirst.status, 1, 'An option must not be misread as the evidence path.');
  assert.match(`${optionFirst.stdout}\n${optionFirst.stderr}`, /Evidence output path must be the first positional argument/);
  assert.equal(fs.existsSync(path.join(tempRoot, '--source-native')), false, 'An option must not be written as screenshot evidence.');
  assert.deepEqual(fs.readdirSync(tempRoot).filter((entry) => entry.startsWith('youtube-ui-smoke-')).sort(), profilesBeforeOptionFirst,
    'An option in the evidence position must fail before creating a user-data profile.');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log('YouTube UI CLI target and candidate bundle boundary tests passed.');
