import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, must } from '@/lib/server/http';

/** 관리자 화면 기간 파라미터 → 한국 날짜 from/to */
export function periodOf(sp) {
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const p = sp.get('period') || '7d';
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (p === 'custom' && re.test(sp.get('from') ?? '') && re.test(sp.get('to') ?? '')) {
    let from = sp.get('from');
    let to = sp.get('to');
    if (from > to) [from, to] = [to, from];
    const days = (new Date(to) - new Date(from)) / 86400000;
    if (days > 366) throw new HttpError(400, 'PERIOD_TOO_LONG');
    return { from, to };
  }
  const n = p === 'today' ? 0 : p === '30d' ? 29 : 6;
  const start = new Date(today);
  start.setDate(start.getDate() - n);
  return { from: fmt(start), to: fmt(today) };
}

/** 리더 상태: 마지막 신호 3분 이내면 정상 */
export function readerState(r) {
  if (!r.is_active) return 'inactive';
  if (!r.registered_at) return 'unregistered';
  const fresh = r.last_seen_at && Date.now() - new Date(r.last_seen_at).getTime() < 3 * 60 * 1000;
  return fresh ? 'ok' : 'down';
}

export async function listReaders(service, orgId) {
  let q = supabaseAdmin()
    .from('readers')
    .select('id, name, organization_id, checkpoint_id, reg_code, reg_code_expires_at, pin_hash, is_active, registered_at, last_seen_at, pending_count, organizations!inner(service, name), checkpoints(name, sites(name))')
    .eq('organizations.service', service)
    .order('created_at');
  if (orgId) q = q.eq('organization_id', orgId);
  const rows = must(await q, 'readers');
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    organization_id: r.organization_id,
    org_name: r.organizations?.name,
    checkpoint_id: r.checkpoint_id,
    checkpoint_name: r.checkpoints?.name ?? null,
    site_name: r.checkpoints?.sites?.name ?? null,
    reg_code: r.reg_code_expires_at && new Date(r.reg_code_expires_at) > new Date() ? r.reg_code : null,
    reg_code_expires_at: r.reg_code_expires_at,
    has_pin: Boolean(r.pin_hash),
    is_active: r.is_active,
    registered_at: r.registered_at,
    last_seen_at: r.last_seen_at,
    pending_count: r.pending_count,
    state: readerState(r),
  }));
}

/** CSV (엑셀 한글 깨짐 방지 BOM) */
export function csv(rows, header) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const lines = [header.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))];
  return `﻿${lines.join('\r\n')}\r\n`;
}

export function csvResponse(body, filename) {
  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    },
  });
}

/** 키링 코드 앞 4자리 가림 (T-A-08) */
export function maskFront(code) {
  return code ? `****${code.slice(4)}` : '';
}
