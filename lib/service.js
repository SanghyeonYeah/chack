export const SERVICES = ['tour', 'pilgrim'];

export const SERVICE_LABEL = {
  tour: { name: '착 · 관광지', short: '관광지', place: '관광지' },
  pilgrim: { name: '착 · 순례', short: '순례', place: '성지' },
};

export function isService(v) {
  return typeof v === 'string' && SERVICES.includes(v);
}

function hostList(raw) {
  return (raw ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function bareHost(hostHeader) {
  return (hostHeader ?? '').split(':')[0].toLowerCase();
}

/**
 * 환경변수 목록에 명시된 주소일 때만 웹을 돌려준다. 없으면 null.
 * (리더 등록처럼 잘못된 주소를 막아야 할 때 사용)
 */
export function explicitHostService(hostHeader, env = process.env) {
  const host = bareHost(hostHeader);
  if (hostList(env.TOUR_HOSTS).includes(host)) return 'tour';
  if (hostList(env.PILGRIM_HOSTS).includes(host)) return 'pilgrim';
  return null;
}

/**
 * 접속 주소(호스트)로 관광지/순례 웹을 판별한다.
 * 두 웹 모두 /k/코드 경로를 쓰므로 경로로는 구분할 수 없다.
 */
export function resolveService(hostHeader, env = process.env) {
  const explicit = explicitHostService(hostHeader, env);
  if (explicit) return explicit;
  const host = bareHost(hostHeader);
  if (host.startsWith('tour.')) return 'tour';
  if (host.startsWith('pilgrim.')) return 'pilgrim';
  return isService(env.DEFAULT_SERVICE) ? env.DEFAULT_SERVICE : 'tour';
}
