// GET  /api/tokens/{code}/completions/{id}      — T-U-10 / P-U-09 완주 화면 데이터 (그 완주분 보너스만, C4)
// POST /api/tokens/{code}/completions/{id}?seen  — 완주 화면 확인 처리
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, route, serviceOf, uuidOrNull } from '@/lib/server/http';
import { requireToken } from '@/lib/server/token';
import { getSettings, pointsOn } from '@/lib/server/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function load(req, params) {
  const { code, id } = await params;
  const cid = uuidOrNull(id);
  if (!cid) throw new HttpError(404, 'NOT_FOUND');
  const service = serviceOf(req);
  const token = await requireToken(req, code, service);
  return { token, cid, service };
}

export const GET = route(async (req, { params }) => {
  const { token, cid, service } = await load(req, params);
  const sb = supabaseAdmin();
  const d = must(await sb.rpc('completion_detail', { p_token: token.id, p_completion: cid }), 'completion');
  if (!d) throw new HttpError(404, 'NOT_FOUND');
  const settings = await getSettings();
  const showPoints = pointsOn(service, settings);
  let verse = null;
  if (service === 'pilgrim') {
    // B8: 노출 구절 중 무작위 1개
    const { data } = await sb.from('verses').select('text, source').eq('is_visible', true);
    if (data?.length) verse = data[Math.floor(Math.random() * data.length)];
  }
  return json({
    ok: true,
    ...d,
    points: showPoints ? d.points : null,
    bonuses: d.bonuses.map((b) => ({ ...b, points: showPoints ? b.points : null })),
    verse,
  });
});

export const POST = route(async (req, { params }) => {
  const { token, cid } = await load(req, params);
  must(
    await supabaseAdmin().from('completions').update({ seen_by_user: true }).eq('id', cid).eq('token_id', token.id),
    'seen',
  );
  return json({ ok: true });
});
