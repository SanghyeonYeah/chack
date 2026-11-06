// P-A-05 신부님 수정 · 삭제
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin, requireSiteAccess } from '@/lib/server/auth';
import { pick } from '@/lib/server/fields';
import { priestSpec } from '../spec';

export const dynamic = 'force-dynamic';

async function ctx(params) {
  const a = await requireAdmin();
  if (a.service !== 'pilgrim') throw new HttpError(404, 'NOT_FOUND');
  const { id } = await params;
  const pid = uuidOrNull(id);
  if (!pid) throw new HttpError(404, 'NOT_FOUND');
  const p = must(await supabaseAdmin().from('priests').select('*').eq('id', pid).maybeSingle());
  if (!p) throw new HttpError(404, 'NOT_FOUND');
  await requireSiteAccess(a, p.site_id);
  return { pid, p };
}

export const PUT = route(async (req, { params }) => {
  const { pid, p } = await ctx(params);
  const patch = pick(await readJson(req), priestSpec);
  const next = { ...p, ...patch };
  if (patch.consent_checked === false) patch.is_visible = false; // 동의를 풀면 표시도 끔
  else if (next.is_visible && !next.consent_checked) throw new HttpError(400, 'CONSENT_REQUIRED');
  must(await supabaseAdmin().from('priests').update(patch).eq('id', pid));
  return json({ ok: true });
});

export const DELETE = route(async (req, { params }) => {
  const { pid } = await ctx(params);
  must(await supabaseAdmin().from('priests').delete().eq('id', pid));
  return json({ ok: true });
});
