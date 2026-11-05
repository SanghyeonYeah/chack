/**
 * 키링 코드 형식 (기획서 3.2 + 결정 C1)
 * - 8자리, 영문 대문자 + 숫자, 0·O·1·I·L 제외 → 31자
 * - 실제 발급은 DB 함수 public.issue_tokens()가 한다(중복 방지는 UNIQUE 제약).
 * - 이 파일은 화면에서 입력 형식을 미리 확인할 때 쓴다.
 */
export const KEYRING_CODE_LENGTH = 8;
export const KEYRING_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const KEYRING_CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/;

/** 사용자가 입력한 코드: 공백·하이픈 제거 후 대문자 */
export function normalizeKeyringCode(input) {
  return String(input ?? '').replace(/[\s-]/g, '').toUpperCase();
}

export function isKeyringCodeFormat(code) {
  return KEYRING_CODE_RE.test(code);
}
