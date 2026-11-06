// T-U-08 / P-U-07 사진 등록 · 삭제 (token_code 일치 확인, 규칙 14)
// POST {step:'prepare'}                     → 남은 칸 확인 + 서명 업로드 주소 발급 (브라우저가 진행률을 보며 직접 올림)
// POST {step:'commit', path, width, height} → 업로드된 파일 확인 후 photos 행 추가 (DB 트리거가 3장 제한 보장)
// DELETE ?photo=                            → 사진 삭제
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route, serviceOf, uuidOrNull } from '@/lib/server/http';
import { requireOwnVisit, requireToken, tokenCodeFrom } from '@/lib/server/token';
import { getSettings } from '@/lib/server/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;

async function ctx(req, params) {
  const { id } = await params;
  const vid = uuidOrNull(id);
  if (!vid) throw new HttpError(404, 'VISIT_NOT_FOUND');
  const token = await requireToken(req, tokenCodeFrom(req), serviceOf(req));
  const visit = await requireOwnVisit(token.id, vid);
  return { token, visit };
}

async function photoCount(visitId) {
  const { count } = await supabaseAdmin()
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('visit_id', visitId);
  return count ?? 0;
}

export const POST = route(async (req, { params }) => {
  const { token, visit } = await ctx(req, params);
  const body = await readJson(req);
  const sb = supabaseAdmin();
  const limit = (await getSettings()).photo_limit_per_visit;

  if (body.step === 'prepare') {
    if ((await photoCount(visit.id)) >= limit) throw new HttpError(409, 'PHOTO_LIMIT', { limit });
    const path = `${token.id}/${visit.id}/${randomUUID()}.jpg`;
    const d = must(await sb.storage.from('photos').createSignedUploadUrl(path), 'sign');
    return json({ ok: true, path, upload_url: d.signedUrl });
  }

  if (body.step === 'commit') {
    const path = typeof body.path === 'string' ? body.path : '';
    if (!path.startsWith(`${token.id}/${visit.id}/`) || !/^[\w/-]+\.jpg$/.test(path)) {
      throw new HttpError(400, 'BAD_PATH');
    }
    const folder = path.slice(0, path.lastIndexOf('/'));
    const name = path.slice(path.lastIndexOf('/') + 1);
    const files = must(await sb.storage.from('photos').list(folder, { search: name }), 'list');
    const file = files.find((f) => f.name === name);
    if (!file) throw new HttpError(400, 'NOT_UPLOADED');
    const bytes = file.metadata?.size ?? null;
    if (bytes && bytes > MAX_BYTES) {
      await sb.storage.from('photos').remove([path]);
      throw new HttpError(413, 'TOO_LARGE');
    }
    const { data, error } = await sb
      .from('photos')
      .insert({
        token_id: token.id,
        visit_id: visit.id,
        storage_path: path,
        width: Number.isFinite(body.width) ? Math.round(body.width) : null,
        height: Number.isFinite(body.height) ? Math.round(body.height) : null,
        bytes,
      })
      .select('id')
      .single();
    if (error) {
      await sb.storage.from('photos').remove([path]);
      if (/PHOTO_LIMIT/.test(error.message)) throw new HttpError(409, 'PHOTO_LIMIT', { limit });
      throw error;
    }
    return json({ ok: true, id: data.id });
  }

  throw new HttpError(400, 'BAD_REQUEST');
});

export const DELETE = route(async (req, { params }) => {
  const { token, visit } = await ctx(req, params);
  const pid = uuidOrNull(new URL(req.url).searchParams.get('photo'));
  if (!pid) throw new HttpError(400, 'BAD_REQUEST');
  const sb = supabaseAdmin();
  const photo = must(
    await sb.from('photos').select('id, storage_path').eq('id', pid).eq('visit_id', visit.id).eq('token_id', token.id).maybeSingle(),
    'photo',
  );
  if (!photo) throw new HttpError(404, 'NOT_FOUND');
  must(await sb.from('photos').delete().eq('id', photo.id), 'delete');
  await sb.storage.from('photos').remove([photo.storage_path]);
  return json({ ok: true });
});
