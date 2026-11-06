import { bool, int, lat, list, lng, paths, text } from '@/lib/server/fields';

/** 관광지(T-A-03) / 성지(P-A-03) 입력 항목. 성지는 입장료·포인트 없음 */
export function siteSpec(service) {
  const common = {
    name: (v) => text(v, 100),
    aliases: list,
    address: (v) => text(v, 300),
    lat,
    lng,
    intro: (v) => text(v, 5000),
    photo_paths: (v) => paths(v, 5),
    opening_hours: (v) => text(v, 500),
    closed_days: (v) => text(v, 300),
    parking: (v) => text(v, 300),
    phone: (v) => text(v, 50),
    stamp_image_path: (v) => text(v, 500),
    sort_order: (v) => int(v) ?? 0,
    is_public: bool,
  };
  if (service === 'pilgrim') {
    return {
      ...common,
      diocese: (v) => text(v, 100),
      history_text: (v) => text(v, 20000),
      mass_times: (v) => text(v, 1000),
      group_contact: (v) => text(v, 500),
    };
  }
  return {
    ...common,
    admission_fee: (v) => text(v, 300),
    base_points: (v) => {
      const n = int(v);
      return n == null || n < 0 ? null : n;
    },
  };
}
