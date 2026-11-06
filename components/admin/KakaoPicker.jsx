'use client';
// 지도에서 찍어 좌표 입력 (T-A-03 대표 좌표, T-A-04 지점 좌표)
import KakaoMap from '@/components/KakaoMap';

export default function KakaoPicker({ lat, lng, onChange, others = [], height = 300 }) {
  const has = lat != null && lat !== '' && lng != null && lng !== '';
  const pick = has ? { lat: Number(lat), lng: Number(lng) } : null;
  return (
    <div>
      <KakaoMap
        height={height}
        points={others}
        pick={pick}
        center={pick ?? others.find((o) => o.lat != null) ?? { lat: 36.79, lng: 127.0 }}
        onPick={(la, ln) => onChange(Number(la.toFixed(7)), Number(ln.toFixed(7)))}
        fallback="좌표를 직접 입력해 주세요"
      />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input className="input" placeholder="위도" value={lat ?? ''} onChange={(e) => onChange(e.target.value, lng)} aria-label="위도" />
        <input className="input" placeholder="경도" value={lng ?? ''} onChange={(e) => onChange(lat, e.target.value)} aria-label="경도" />
      </div>
      <p className="mt-1 small muted">지도를 누르면 그 자리가 좌표로 들어가요</p>
    </div>
  );
}
