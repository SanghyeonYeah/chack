/** 모든 날짜 판정·표시는 Asia/Seoul 기준 */
const TZ = 'Asia/Seoul';
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parts(d) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const o = Object.fromEntries(f.formatToParts(new Date(d)).map((p) => [p.type, p.value]));
  return { y: o.year, m: o.month, d: o.day, hh: o.hour, mm: o.minute, wd: WEEK[EN.indexOf(o.weekday)] };
}

const isDateOnly = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

export function seoulDate(d = new Date()) {
  const p = parts(d);
  return `${p.y}-${p.m}-${p.d}`;
}
/** "10/31" */
export function md(d) {
  if (isDateOnly(d)) return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  const p = parts(d);
  return `${Number(p.m)}/${Number(p.d)}`;
}
/** "14:02" */
export function hm(d) {
  const p = parts(d);
  return `${p.hh}:${p.mm}`;
}
/** "2026.10.31 (토) 14:20" */
export function full(d) {
  const p = parts(d);
  return `${p.y}.${p.m}.${p.d} (${p.wd}) ${p.hh}:${p.mm}`;
}
/** "2026.10.31" */
export function ymd(d) {
  if (isDateOnly(d)) return d.replaceAll('-', '.');
  const p = parts(d);
  return `${p.y}.${p.m}.${p.d}`;
}
/** 한국 날짜 기준 며칠 전 */
export function daysAgo(d) {
  const a = new Date(`${seoulDate(d)}T00:00:00Z`);
  const b = new Date(`${seoulDate()}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}
export function maskCode(code) {
  return code ? `····${code.slice(-4)}` : '';
}
/** 소수점 버림 (3.5) */
export function rate(done, total) {
  return total > 0 ? Math.floor((done / total) * 100) : 0;
}
/** 두 좌표 직선거리 km (브라우저에서만 계산, 위치는 서버로 보내지 않음) */
export function km(a, b) {
  if (a?.lat == null || b?.lat == null) return null;
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
