// POST /api/admin/upload {kind, ext} — 공개 media 버킷 서명 업로드 주소 (관광지·지점·도장·뱃지·신부님 사진)
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';
const KINDS = ['sites', 'checkpoints', 'stamps', 'badges', 'priests'];

export const POST = route(async (req) => {
  const a = await requireAdmin();
  const b = await readJson(req);
  if (!KINDS.includes(b.kind)) throw new HttpError(400, 'BAD_KIND');
  if (b.kind === 'badges' && a.role !== 'super') throw new HttpError(403, 'FORBIDDEN');
  const ext = ['jpg', 'png', 'webp'].includes(b.ext) ? b.ext : 'jpg';
  const path = `${b.kind}/${a.orgId ?? 'super'}/${randomUUID()}.${ext}`;
  const d = must(await supabaseAdmin().storage.from('media').createSignedUploadUrl(path), 'sign');
  return json({ ok: true, path, upload_url: d.signedUrl });
});
