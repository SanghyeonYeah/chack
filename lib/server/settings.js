import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const SETTING_DEFAULTS = {
  base_points: 100,
  sigungu_multiplier: 5,
  sido_multiplier: 10,
  pilgrim_points_enabled: false,
  point_exchange_enabled: false,
  photo_limit_per_visit: 3,
};

export async function getSettings() {
  const { data } = await supabaseAdmin().from('settings').select('key, value');
  const out = { ...SETTING_DEFAULTS };
  for (const row of data ?? []) out[row.key] = row.value;
  return out;
}

/** 이 웹에서 포인트를 보여 줄지 (순례는 스위치가 켜졌을 때만, 규칙 8) */
export function pointsOn(service, settings) {
  return service === 'tour' || settings.pilgrim_points_enabled === true;
}
