import crypto from 'node:crypto';

export const expectedHelperBundleNames = [
  '離線字幕工廠 Helper.app',
  '離線字幕工廠 Helper (GPU).app',
  '離線字幕工廠 Helper (Plugin).app',
  '離線字幕工廠 Helper (Renderer).app',
];

export const expectedCodeObjectLabels = [
  'main-app',
  'electron-framework',
  ...expectedHelperBundleNames.map((name) => `helper:${name}`),
];

const expectedTeamIdentifierDiagnosticCount = expectedCodeObjectLabels.length;

function text(value) {
  return typeof value === 'string' ? value : '';
}

function digest(value) {
  return crypto.createHash('sha256').update(text(value)).digest('hex');
}

function bytes(value) {
  return Buffer.byteLength(text(value), 'utf8');
}

export function classifyCodeSign({
  status,
  errorCode = null,
  stdout = '',
  stderr = '',
  verificationSucceeded = false,
  entitlementsCommandSucceeded = false,
  entitlementsPresent = false,
}) {
  const diagnostic = `${text(stdout)}\n${text(stderr)}`;
  const flags = diagnostic.match(/CodeDirectory[^\n]*\bflags=([^\s]+)/i)?.[1] || null;
  const teamIdentifier = diagnostic.match(/^TeamIdentifier=([^\r\n]+)$/m)?.[1] || null;
  const teamIdentifierPresent = Boolean(teamIdentifier && teamIdentifier !== 'not set');
  return {
    commandSucceeded: status === 0 && !errorCode,
    developerIdApplicationPresent: /^Authority=Developer ID Application:/m.test(diagnostic),
    teamIdentifierPresent,
    runtimeFlagObserved: Boolean(flags && /\bruntime\b/i.test(flags)),
    adHocFlagObserved: Boolean(flags && /\badhoc\b/i.test(flags)),
    flagsObserved: Boolean(flags),
    diagnosticSha256: digest(diagnostic),
    diagnosticBytes: bytes(diagnostic),
    verificationSucceeded: verificationSucceeded === true,
    entitlementsCommandSucceeded: entitlementsCommandSucceeded === true,
    entitlementsPresent: entitlementsPresent === true,
  };
}

export function classifyEntitlements({
  status,
  errorCode = null,
  stdout = '',
  stderr = '',
}) {
  const diagnostic = `${text(stdout)}\n${text(stderr)}`;
  return {
    commandSucceeded: status === 0 && !errorCode,
    present: /<plist\b[^>]*>[\s\S]*<dict\b[^>]*>[\s\S]*<\/dict>[\s\S]*<\/plist>/i.test(diagnostic),
    diagnosticSha256: digest(diagnostic),
    diagnosticBytes: bytes(diagnostic),
  };
}

export function classifyStapler({
  status,
  errorCode = null,
  stdout = '',
  stderr = '',
}) {
  const diagnostic = `${text(stdout)}\n${text(stderr)}`;
  const recognizedSuccess = /^\s*The (?:staple and )?validate action worked!\s*$/im.test(diagnostic)
    && !/invalid|not\s+valid|no ticket|not found|error|failed/i.test(diagnostic);
  return {
    commandSucceeded: status === 0 && !errorCode,
    recognizedSuccess,
    status: status === 0 && !errorCode && recognizedSuccess ? 'valid' : 'invalid',
    diagnosticSha256: digest(diagnostic),
    diagnosticBytes: bytes(diagnostic),
  };
}

export function classifyGatekeeper({
  status,
  errorCode = null,
  stdout = '',
  stderr = '',
}) {
  const diagnostic = `${text(stdout)}\n${text(stderr)}`;
  const recognizedRejection = /rejected|invalid|not notarized|cannot be opened|error|failed/i.test(diagnostic);
  const acceptedMarker = /(?:^|\n)\s*(?:[^:\n]+:\s*)?accepted\s*$/im.test(diagnostic);
  const notarizedSourceMarker = /(?:^|\n)\s*source=Notarized Developer ID\s*$/im.test(diagnostic);
  return {
    commandSucceeded: status === 0 && !errorCode,
    recognizedRejection,
    status: status === 0 && !errorCode && !recognizedRejection && acceptedMarker && notarizedSourceMarker ? 'accepted' : 'rejected',
    recognizedSuccess: acceptedMarker && notarizedSourceMarker && !recognizedRejection,
    diagnosticSha256: digest(diagnostic),
    diagnosticBytes: bytes(diagnostic),
  };
}

export function compareTeamIdentifiers(diagnostics, expectedDiagnosticDigests) {
  if (!Array.isArray(diagnostics) || diagnostics.length !== expectedTeamIdentifierDiagnosticCount
    || !Array.isArray(expectedDiagnosticDigests) || expectedDiagnosticDigests.length !== expectedTeamIdentifierDiagnosticCount) return false;
  if (!diagnostics.every((value, index) => digest(value) === expectedDiagnosticDigests[index])) return false;
  const teamIdentifiers = diagnostics.map((value) => text(value).match(/^TeamIdentifier=([^\r\n]+)$/m)?.[1] || null);
  return teamIdentifiers.every((value) => value && value !== 'not set')
    && new Set(teamIdentifiers).size === 1;
}

function exactNames(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function sourceConfigReady(sourceBuildConfig) {
  return sourceBuildConfig?.sourceConfigReady === true
    && sourceBuildConfig.hardenedRuntimeConfigured === true
    && sourceBuildConfig.gatekeeperAssessConfigured === true
    && sourceBuildConfig.macTargetConfigured === true
    && (sourceBuildConfig.identityConfiguration === 'auto-discovery'
      || sourceBuildConfig.identityConfiguration === 'explicit-string');
}

function codeObjectReady(object) {
  const codeSign = object?.codeSign;
  return object?.label
    && codeSign?.commandSucceeded === true
    && codeSign.verificationSucceeded === true
    && codeSign.developerIdApplicationPresent === true
    && codeSign.teamIdentifierPresent === true
    && codeSign.runtimeFlagObserved === true
    && codeSign.adHocFlagObserved === false
    && codeSign.entitlementsCommandSucceeded === true
    && codeSign.entitlementsPresent === true;
}

export function evaluateSignedCanaryVerification({
  sourceBuildConfig,
  helperInventory,
  objects,
  stapler,
  gatekeeper,
  teamIdentifierDiagnostics,
  candidateMetadataValid = true,
  sourceProvenanceReady = true,
}) {
  const reasons = [];
  const inventoryReady = helperInventory?.complete === true
    && exactNames(helperInventory?.frameworkAppEntries, expectedHelperBundleNames)
    && exactNames(helperInventory?.missingHelperBundleNames, [])
    && exactNames(helperInventory?.unexpectedHelperBundleNames, []);
  const objectLabels = Array.isArray(objects) ? objects.map((object) => object?.label) : [];
  const objectSetReady = exactNames(objectLabels, expectedCodeObjectLabels);
  const objectsReady = objectSetReady && objects.every(codeObjectReady);
  const expectedDiagnosticDigests = Array.isArray(objects)
    ? objects.map((object) => object?.codeSign?.diagnosticSha256)
    : [];
  const teamIdentifiersConsistent = objectsReady && compareTeamIdentifiers(teamIdentifierDiagnostics, expectedDiagnosticDigests);
  const notarizationReady = stapler?.status === 'valid'
    && stapler?.recognizedSuccess === true
    && gatekeeper?.status === 'accepted'
    && gatekeeper?.recognizedRejection === false
    && gatekeeper?.recognizedSuccess === true;
  const sourceReady = sourceConfigReady(sourceBuildConfig);

  if (!sourceReady) reasons.push('source-config-not-ready');
  if (candidateMetadataValid !== true) reasons.push('candidate-metadata-not-ready');
  if (sourceProvenanceReady !== true) reasons.push('source-provenance-not-ready');
  if (!inventoryReady) reasons.push('helper-inventory-not-ready');
  if (!objectSetReady) reasons.push('code-object-inventory-not-ready');
  if (!objectsReady) reasons.push('code-object-signature-not-ready');
  if (!teamIdentifiersConsistent) reasons.push('team-identity-not-ready');
  if (!notarizationReady) reasons.push('notarization-or-gatekeeper-not-ready');

  return {
    ready: reasons.length === 0,
    reasons,
    sourceReady,
    candidateMetadataValid: candidateMetadataValid === true,
    sourceProvenanceReady: sourceProvenanceReady === true,
    inventoryReady,
    objectSetReady,
    objectsReady,
    teamIdentifiersConsistent,
    notarizationReady,
  };
}
