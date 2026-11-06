import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** 비공개 사진 버킷: 시간 제한 서명 링크 (C5) */
export async function signPhotos(paths, seconds = 3600) {
  if (!paths.length) return {};
  const { data } = await supabaseAdmin().storage.from('photos').createSignedUrls(paths, seconds);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}
