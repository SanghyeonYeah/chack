import 'server-only';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { resolveService } from '@/lib/service';

export class HttpError extends Error {
  constructor(status, code, extra) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export function bearer(req) {
  const h = req.headers.get('authorization') ?? '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

export async function readJson(req) {
  try {
    return (await req.json()) ?? {};
  } catch {
    return {};
  }
}

/** 요청이 들어온 웹 (미들웨어가 붙인 헤더 → 없으면 주소) */
export function serviceOf(req) {
  const h = req.headers.get('x-chak-service');
  if (h === 'tour' || h === 'pilgrim') return h;
  return resolveService(req.headers.get('host'));
}

/** IP 원문 대신 해시값으로 차단 키를 만듦 */
export function ipKey(req, scope) {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  const ip = fwd.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const salt = process.env.IP_HASH_SALT ?? '';
  return `${scope}:${createHash('sha256').update(`${salt}:${ip}`).digest('hex')}`;
}

/** 라우트 공통 오류 처리: 사용자에게는 코드만, 상세는 서버 로그에만 */
export function route(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ ok: false, error: e.code, ...(e.extra ?? {}) }, e.status);
      console.error('[api]', req.method, req.url, e);
      return json({ ok: false, error: 'SERVER_ERROR' }, 500);
    }
  };
}

/** supabase 응답에서 오류면 던지기 */
export function must({ data, error }, label = 'db') {
  if (error) {
    const e = new Error(`${label}: ${error.message}`);
    e.cause = error;
    throw e;
  }
  return data;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuidOrNull(v) {
  return typeof v === 'string' && UUID_RE.test(v) ? v : null;
}
