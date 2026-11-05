import { KEYRING_CODE_RE } from '@/lib/keyring-code';

const PATH_RE = /\/k\/([A-Za-z0-9]{8})(?=[/?#]|$)/;

/** "https://주소/k/ABCD2345" → "ABCD2345" */
export function extractCode(text) {
  const m = text.match(PATH_RE);
  if (!m) return null;
  const code = m[1].toUpperCase();
  return KEYRING_CODE_RE.test(code) ? code : null;
}

/** NDEF 메시지의 URL 레코드에서 키링 코드 추출 (실패 시 null → 칩 UID로 대체) */
export function readCodeFromMessage(message) {
  if (!message) return null;
  for (const rec of message.records) {
    if (!rec.data) continue;
    if (rec.recordType === 'url' || rec.recordType === 'absolute-url' || rec.recordType === 'text') {
      const text = new TextDecoder(rec.encoding ?? 'utf-8').decode(rec.data);
      const code = extractCode(text);
      if (code) return code;
    }
  }
  return null;
}

/** "04:a1:..." 형태의 칩 UID를 대문자 16진수로 */
export function normalizeUid(serial) {
  if (!serial) return null;
  const hex = serial.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  return hex.length >= 8 ? hex : null;
}
