// S-05 서비스 설정: 완주 기본 포인트, 시·군·도 배수, 기능 스위치, 사진 장수
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { getSettings, SETTING_DEFAULTS } from '@/lib/server/settings';

export const dynamic = 'force-dynamic';

const RULES = {
  base_points: (v) => Number.isInteger(v) && v >= 0 && v <= 100000,
  sigungu_multiplier: (v) => Number.isInteger(v) && v >= 0 && v <= 1000,
  sido_multiplier: (v) => Number.isInteger(v) && v >= 0 && v <= 1000,
  photo_limit_per_visit: (v) => Number.isInteger(v) && v >= 1 && v <= 10,
  pilgrim_points_enabled: (v) => typeof v === 'boolean',
  point_exchange_enabled: (v) => typeof v === 'boolean',
};

export const GET = route(async () => {
  await requireAdmin({ superOnly: true });
  return json({ ok: true, settings: await getSettings(), defaults: SETTING_DEFAULTS });
});

export const PUT = route(async (req) => {
  await requireAdmin({ superOnly: true });
  const b = await readJson(req);
  const rows = [];
  for (const [k, ok] of Object.entries(RULES)) {
    if (!(k in b)) continue;
    const v = typeof SETTING_DEFAULTS[k] === 'number' ? Number(b[k]) : b[k];
    if (!ok(v)) throw new HttpError(400, `BAD_${k.toUpperCase()}`);
    rows.push({ key: k, value: v });
  }
  if (rows.length) must(await supabaseAdmin().from('settings').upsert(rows, { onConflict: 'key' }));
  return json({ ok: true });
});
