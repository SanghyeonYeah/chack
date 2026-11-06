// GET /api/admin/export?type=visits|daily|checkpoints&period=… — T-A-08 / P-A-10 CSV
// 키링 코드는 앞 4자리 가림, 사진·메모 제외 (규칙 13)
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HttpError, must, route, uuidOrNull } from '@/lib/server/http';
import { requireAdmin, scopeOrg } from '@/lib/server/auth';
import { csv, csvResponse, maskFront, periodOf } from '@/lib/server/admin-data';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const a = await requireAdmin();
  const sp = new URL(req.url).searchParams;
  const org = scopeOrg(a, uuidOrNull(sp.get('org')));
  const { from, to } = periodOf(sp);
  const type = sp.get('type') || 'visits';
  const sb = supabaseAdmin();
  const label = a.service === 'pilgrim' ? '성지' : '관광지';

  if (type === 'visits') {
    let q = sb
      .from('visits')
      .select('visit_date, tagged_at, received_at, tokens(code), checkpoints(name), sites!inner(name, service, organization_id)')
      .eq('sites.service', a.service)
      .gte('visit_date', from)
      .lte('visit_date', to)
      .order('tagged_at')
      .limit(50000);
    if (org) q = q.eq('sites.organization_id', org);
    const rows = must(await q, 'visits');
    const fmt = (t) => new Date(t).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });
    return csvResponse(
      csv(
        rows.map((r) => [r.visit_date, fmt(r.tagged_at), maskFront(r.tokens?.code), r.sites?.name, r.checkpoints?.name, fmt(r.received_at)]),
        ['방문일', '태그 시각', '키링', label, '지점', '서버 수신 시각'],
      ),
      `방문기록_${from}_${to}.csv`,
    );
  }

  const stats = must(await sb.rpc('admin_stats', { p_service: a.service, p_org: org, p_from: from, p_to: to }), 'stats');
  if (type === 'daily') {
    return csvResponse(
      csv(stats.daily.map((d) => [d.date, d.keyrings, d.stamps]), ['날짜', '참여 키링', a.service === 'pilgrim' ? '인장 수' : '도장 수']),
      `날짜별_${from}_${to}.csv`,
    );
  }
  if (type === 'checkpoints') {
    return csvResponse(
      csv(stats.by_checkpoint.map((c) => [c.site_name, c.name, c.count]), [label, '지점', '방문 수']),
      `지점별_${from}_${to}.csv`,
    );
  }
  if (type === 'funnel') {
    const f = stats.funnel;
    return csvResponse(
      csv(
        [
          ['첫 태그', f.first_tag],
          ['2개 지점 이상', f.two_points],
          [a.service === 'pilgrim' ? '순례 완료' : '완주', f.completed],
          [a.service === 'pilgrim' ? '사진 또는 메모 1개 이상' : '사진 1장 이상', f.photo],
          ['마지막 도장 7일 지난 키링', f.retag_base],
          ['7일 후 폰 재태그 (nfc+manual)', f.retag],
          ['└ nfc', f.retag_nfc],
          ['└ 코드 직접 입력', f.retag_manual],
        ],
        ['단계', '키링 수'],
      ),
      `단계별이탈_${from}_${to}.csv`,
    );
  }
  throw new HttpError(400, 'BAD_TYPE');
});
