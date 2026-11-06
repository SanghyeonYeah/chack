// P-U-07 순례 메모 저장·삭제 (순례 웹만, 500자, 본인만). 관리자 조회 API 없음 (규칙 13)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route, serviceOf, uuidOrNull } from '@/lib/server/http';
import { requireOwnVisit, requireToken, tokenCodeFrom } from '@/lib/server/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ctx(req, params) {
  const service = serviceOf(req);
  if (service !== 'pilgrim') throw new HttpError(404, 'NOT_FOUND');
  const { id } = await params;
  const vid = uuidOrNull(id);
  if (!vid) throw new HttpError(404, 'VISIT_NOT_FOUND');
  const token = await requireToken(req, tokenCodeFrom(req), service);
  const visit = await requireOwnVisit(token.id, vid);
  return { token, visit };
}

export const PUT = route(async (req, { params }) => {
  const { token, visit } = await ctx(req, params);
  const body = String((await readJson(req)).body ?? '').trim();
  if (!body) throw new HttpError(400, 'EMPTY');
  if ([...body].length > 500) throw new HttpError(400, 'TOO_LONG');
  must(
    await supabaseAdmin()
      .from('notes')
      .upsert({ token_id: token.id, visit_id: visit.id, body }, { onConflict: 'visit_id' }),
    'note',
  );
  return json({ ok: true });
});

export const DELETE = route(async (req, { params }) => {
  const { token, visit } = await ctx(req, params);
  must(await supabaseAdmin().from('notes').delete().eq('visit_id', visit.id).eq('token_id', token.id), 'note');
  return json({ ok: true });
});
