import 'server-only';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';

export function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export function bearer(req) {
  const h = req.headers.get('authorization') ?? '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

/** IP 원문 대신 해시값으로 차단 키를 만든다 (E9) */
export function ipKey(req, scope) {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  const ip = fwd.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const salt = process.env.IP_HASH_SALT ?? '';
  return `${scope}:${createHash('sha256').update(`${salt}:${ip}`).digest('hex')}`;
}
