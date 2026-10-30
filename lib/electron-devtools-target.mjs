function isValidPort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

export function isLocalElectronPageUrl(value) {
  let url;
  try { url = new URL(String(value)); } catch { return false; }
  return url.protocol === 'http:'
    && url.hostname === '127.0.0.1'
    && isValidPort(url.port)
    && !url.username
    && !url.password;
}

export function isTrustedDevToolsWebSocketUrl(value, expectedPort) {
  if (!isValidPort(expectedPort)) return false;
  let url;
  try { url = new URL(String(value)); } catch { return false; }
  return url.protocol === 'ws:'
    && url.hostname === '127.0.0.1'
    && Number(url.port) === Number(expectedPort)
    && url.pathname.startsWith('/devtools/page/')
    && !url.username
    && !url.password
    && !url.search
    && !url.hash;
}

export function createTrustedDevToolsWebSocket(value, expectedPort, WebSocketConstructor = globalThis.WebSocket) {
  if (!isTrustedDevToolsWebSocketUrl(value, expectedPort)) {
    throw new Error('DEVTOOLS_TARGET_URL_REJECTED');
  }
  if (typeof WebSocketConstructor !== 'function') throw new Error('DEVTOOLS_WEBSOCKET_UNAVAILABLE');
  return new WebSocketConstructor(value);
}

export function selectTrustedElectronPageTarget(targets, expectedPort) {
  // The file:// splash screen is excluded by the loopback URL check; the UI
  // target title may remain empty while Chromium is still publishing the page.
  const page = targets.find((target) => target.type === 'page'
    && isLocalElectronPageUrl(target.url));
  if (!page) return null;
  if (!isTrustedDevToolsWebSocketUrl(page.webSocketDebuggerUrl, expectedPort)) {
    throw new Error('DEVTOOLS_TARGET_URL_REJECTED');
  }
  return page;
}
