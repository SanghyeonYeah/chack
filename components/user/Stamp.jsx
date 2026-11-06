// 대표 도장 / 순례 인장 / 뱃지 자리 표시 (이미지가 없으면 SVG 원형 도장 + 이름, 규칙 20)
import { mediaUrl } from '@/lib/media';

export function Stamp({ name, image, size = 180, className = '', muted = false }) {
  const url = mediaUrl(image);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={`${name} 도장`} width={size} height={size} className={className} style={{ objectFit: 'contain' }} />;
  }
  const label = name.length > 6 ? `${name.slice(0, 6)}…` : name;
  const color = muted ? 'var(--c-line)' : 'var(--c-stamp)';
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} role="img" aria-label={`${name} 도장`}>
      <circle cx="100" cy="100" r="92" fill="none" stroke={color} strokeWidth="7" />
      <circle cx="100" cy="100" r="78" fill="none" stroke={color} strokeWidth="2" strokeDasharray="3 5" />
      <text x="100" y="98" textAnchor="middle" fontFamily="var(--font-serif)" fontWeight="700" fontSize="56" fill={color}>
        착
      </text>
      <text x="100" y="138" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="700" fontSize={label.length > 4 ? 20 : 24} fill={color}>
        {label}
      </text>
    </svg>
  );
}

/** 지역 뱃지: 획득 = 색, 미획득 = 회색 실루엣 */
export function Badge({ name, image, earned, size = 88 }) {
  const url = mediaUrl(image);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img src={url} alt={`${name} 뱃지`} width={size} height={size}
        style={{ objectFit: 'contain', filter: earned ? 'none' : 'grayscale(1) opacity(.35)' }} />
    );
  }
  const color = earned ? 'var(--c-accent)' : 'var(--c-line)';
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${name} 뱃지${earned ? '' : ' (미획득)'}`}>
      <path d="M50 6 88 22v28c0 22-16 38-38 44C28 88 12 72 12 50V22z" fill={earned ? 'color-mix(in srgb, var(--c-accent) 14%, transparent)' : 'none'} stroke={color} strokeWidth="4" />
      <text x="50" y="58" textAnchor="middle" fontFamily="var(--font-serif)" fontWeight="700" fontSize={name.length > 3 ? 16 : 20} fill={earned ? 'var(--c-accent)' : 'var(--c-muted)'} opacity={earned ? 1 : 0.6}>
        {name.replace(/(특별자치|광역)?(시|군|도)$/, '') || name}
      </text>
    </svg>
  );
}

/** 사진 자리 표시 */
export function PhotoPlaceholder({ label, className = '' }) {
  return (
    <div className={`grid place-items-center bg-sunk text-muted ${className}`} aria-hidden>
      <svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="6" y="10" width="36" height="28" rx="3" />
        <circle cx="18" cy="21" r="4" />
        <path d="m8 36 11-10 8 7 6-5 9 8" />
      </svg>
      {label && <span className="mt-1 small">{label}</span>}
    </div>
  );
}
