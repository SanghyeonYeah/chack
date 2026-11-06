// S-03 칩 UID 일괄 등록: CSV 본문 "코드,UID" 줄 단위
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, readJson, route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { KEYRING_CODE_RE } from '@/lib/keyring-code';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  await requireAdmin({ superOnly: true });
  const { csv } = await readJson(req);
  if (typeof csv !== 'string' || !csv.trim()) throw new HttpError(400, 'EMPTY');
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 10000);
  const sb = supabaseAdmin();
  const result = { updated: 0, skipped: [] };
  for (const [i, line] of lines.entries()) {
    const [rawCode, rawUid] = line.split(/[,\t;]/).map((s) => (s ?? '').trim());
    const code = (rawCode ?? '').toUpperCase();
    const uid = (rawUid ?? '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
    if (!KEYRING_CODE_RE.test(code)) {
      if (i > 0) result.skipped.push({ line: i + 1, reason: '코드 형식' });
      continue; // 첫 줄은 머리글일 수 있음
    }
    if (uid.length < 8) {
      result.skipped.push({ line: i + 1, reason: 'UID 형식' });
      continue;
    }
    const { data, error } = await sb.from('tokens').update({ chip_uid: uid }).eq('code', code).select('id');
    if (error) result.skipped.push({ line: i + 1, reason: /duplicate|unique/i.test(error.message) ? '이미 다른 키링에 등록된 UID' : '저장 실패' });
    else if (!data.length) result.skipped.push({ line: i + 1, reason: '없는 코드' });
    else result.updated++;
  }
  return json({ ok: true, ...result });
});
