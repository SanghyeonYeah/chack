// S-03 키링 발급: 웹 선택 + 수량 → 코드 일괄 생성 → 기관 배정 → CSV(코드, 키링에 기록할 전체 주소)
// GET ?batch=&service= → 그 묶음 CSV 다시 받기
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, json, must, readJson, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { csv, csvResponse } from '@/lib/server/admin-data';
import { originFor } from '@/lib/service';
import { text } from '@/lib/server/fields';

export const dynamic = 'force-dynamic';

function tokenCsv(rows, service) {
  const origin = originFor(service) ?? `https://(${service} 주소 미설정)`;
  return csv(rows.map((t) => [t.code, `${origin}/k/${t.code}`, t.org_name ?? '', t.batch_label ?? '', t.chip_uid ?? '']), ['코드', '키링에 기록할 주소', '기관', '묶음', '칩 UID']);
}

export const GET = route(async (req) => {
  await requireAdmin({ superOnly: true });
  const sp = new URL(req.url).searchParams;
  const service = sp.get('service') === 'pilgrim' ? 'pilgrim' : 'tour';
  const sb = supabaseAdmin();
  if (sp.get('batches')) {
    const rows = must(await sb.from('tokens').select('batch_label, service, created_at').eq('service', service).order('created_at', { ascending: false }).limit(5000));
    const map = new Map();
    for (const r of rows) {
      const k = r.batch_label ?? '(이름 없음)';
      const cur = map.get(k) ?? { batch: k, count: 0, created_at: r.created_at };
      cur.count++;
      map.set(k, cur);
    }
    return json({ ok: true, batches: [...map.values()], origin: originFor(service) });
  }
  const batch = sp.get('batch');
  let q = sb.from('tokens').select('code, batch_label, chip_uid, organizations(name)').eq('service', service).order('created_at').limit(10000);
  q = batch && batch !== '(이름 없음)' ? q.eq('batch_label', batch) : batch ? q.is('batch_label', null) : q;
  const rows = must(await q).map((t) => ({ ...t, org_name: t.organizations?.name }));
  return csvResponse(tokenCsv(rows, service), `키링_${service}_${batch ?? '전체'}.csv`);
});

export const POST = route(async (req) => {
  await requireAdmin({ superOnly: true });
  const b = await readJson(req);
  const service = b.service === 'pilgrim' ? 'pilgrim' : b.service === 'tour' ? 'tour' : null;
  if (!service) throw new HttpError(400, 'SERVICE_REQUIRED');
  const count = Math.floor(Number(b.count));
  if (!(count >= 1 && count <= 5000)) throw new HttpError(400, 'COUNT_OUT_OF_RANGE');
  const orgId = uuidOrNull(b.organization_id);
  const sb = supabaseAdmin();
  let orgName = null;
  if (orgId) {
    const org = must(await sb.from('organizations').select('service, name').eq('id', orgId).maybeSingle());
    if (!org || org.service !== service) throw new HttpError(400, 'ORG_SERVICE_MISMATCH');
    orgName = org.name;
  }
  const label = text(b.batch_label, 50) ?? `발급 ${new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 16)}`;
  const rows = must(await sb.rpc('issue_tokens', { p_service: service, p_count: count, p_organization_id: orgId, p_batch_label: label }), 'issue');
  return csvResponse(tokenCsv(rows.map((t) => ({ ...t, org_name: orgName })), service), `키링_${service}_${label}.csv`);
});

/** PUT {codes:[...], organization_id} — 기존 재고 키링을 기관에 배정 */
export const PUT = route(async (req) => {
  await requireAdmin({ superOnly: true });
  const b = await readJson(req);
  const codes = (Array.isArray(b.codes) ? b.codes : String(b.codes ?? '').split(/[\s,]+/)).map((c) => String(c).trim().toUpperCase()).filter(Boolean).slice(0, 5000);
  const orgId = uuidOrNull(b.organization_id);
  if (!codes.length) throw new HttpError(400, 'CODES_REQUIRED');
  const sb = supabaseAdmin();
  let service = null;
  if (orgId) service = must(await sb.from('organizations').select('service').eq('id', orgId).single()).service;
  let q = sb.from('tokens').update({ organization_id: orgId }).in('code', codes);
  if (service) q = q.eq('service', service);
  const rows = must(await q.select('id'));
  return json({ ok: true, updated: rows.length });
});
