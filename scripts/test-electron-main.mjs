import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'electron', 'main.mjs'), 'utf8');
const readSecureAiKeys = source.match(/function readSecureAiKeys\(\) \{([\s\S]*?)\n\}/u)?.[1] || '';

assert.ok(readSecureAiKeys, 'readSecureAiKeys 應存在');
const fileCheck = readSecureAiKeys.indexOf('if (!fs.existsSync(securePath)) return {};');
const safeStorageCheck = readSecureAiKeys.indexOf('if (!safeStorage.isEncryptionAvailable()) return {};');
assert.ok(fileCheck >= 0, '乾淨 profile 應先檢查 secure key 檔案是否存在');
assert.ok(safeStorageCheck > fileCheck, 'AI key 檔案不存在時不得先觸發 macOS Keychain');
assert.match(readSecureAiKeys, /fs\.readFileSync\(securePath, 'utf8'\)/u, '解密路徑應重用已檢查的 securePath');

console.log('Electron 啟動安全儲存測試通過：乾淨 profile 不會先觸發 Keychain');
