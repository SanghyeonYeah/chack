import 'server-only';
import { HttpError } from '@/lib/server/http';

/** 관리자 입력값 정리 */
export const text = (v, max = 5000) => {
  if (v == null) return null;
  const s = String(v).trim();
  if (s.length > max) throw new HttpError(400, 'TOO_LONG');
  return s || null;
};
export const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
export const int = (v) => (num(v) == null ? null : Math.round(Number(v)));
export const bool = (v) => v === true || v === 'true';
export const paths = (v, max = 5) =>
  Array.isArray(v) ? v.filter((p) => typeof p === 'string' && p.length < 500).slice(0, max) : [];
export const list = (v) =>
  (Array.isArray(v) ? v : String(v ?? '').split(','))
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 30);

/** 정의한 키만 꺼내기 */
export function pick(body, spec) {
  const out = {};
  for (const [k, fn] of Object.entries(spec)) if (k in body) out[k] = fn(body[k]);
  return out;
}

export function lat(v) {
  const n = num(v);
  if (n != null && (n < -90 || n > 90)) throw new HttpError(400, 'BAD_COORD');
  return n;
}
export function lng(v) {
  const n = num(v);
  if (n != null && (n < -180 || n > 180)) throw new HttpError(400, 'BAD_COORD');
  return n;
}
