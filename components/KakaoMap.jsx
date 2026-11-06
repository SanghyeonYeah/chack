'use client';
/**
 * 카카오맵 (T-U-05 / T-U-06 / 관리자 좌표 찍기)
 * - points: [{ id, lat, lng, label, done, title }] → 번호 마커 + 권장 순서 점선
 * - onPick(lat,lng): 지도를 누르면 좌표 전달 (관리자)
 * - 실패 시 "지도를 불러오지 못했어요 [다시 시도]" + fallback 문구
 */
import { useCallback, useEffect, useRef, useState } from 'react';

let sdkPromise = null;
function loadSdk() {
  if (typeof window === 'undefined') return Promise.reject(new Error('ssr'));
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao);
  if (sdkPromise) return sdkPromise;
  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_JS_KEY;
  if (!key) return Promise.reject(new Error('NO_KEY'));
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`;
    s.async = true;
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), 10000);
    s.onload = () => {
      try {
        window.kakao.maps.load(() => {
          clearTimeout(timer);
          resolve(window.kakao);
        });
      } catch (e) {
        clearTimeout(timer);
        reject(e);
      }
    };
    s.onerror = () => {
      clearTimeout(timer);
      reject(new Error('LOAD_FAILED'));
    };
    document.head.appendChild(s);
  }).catch((e) => {
    sdkPromise = null;
    throw e;
  });
  return sdkPromise;
}

function markerHtml(p, active) {
  const bg = p.done ? 'var(--c-primary)' : 'var(--c-surface)';
  const fg = p.done ? 'var(--c-on-primary)' : 'var(--c-primary)';
  const ring = active ? '0 0 0 4px color-mix(in srgb, var(--c-accent) 35%, transparent),' : '';
  return `<div style="width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:${bg};color:${fg};border:2.5px solid var(--c-primary);font:700 16px/1 var(--font-sans);box-shadow:${ring}0 1px 3px rgba(0,0,0,.25);cursor:pointer">${p.label}</div>`;
}

export default function KakaoMap({
  points = [],
  center,
  height = 280,
  fallback,
  onMarkerClick,
  onPick,
  pick,
  showMe = false,
  activeId,
  level,
  className = '',
}) {
  const box = useRef(null);
  const mapRef = useRef(null);
  const layers = useRef([]);
  const [state, setState] = useState('loading');
  const [tick, setTick] = useState(0);

  const retry = useCallback(() => {
    setState('loading');
    setTick((x) => x + 1);
  }, []);

  useEffect(() => {
    let dead = false;
    loadSdk()
      .then((kakao) => {
        if (dead || !box.current) return;
        const c = center ?? points.find((p) => p.lat != null) ?? { lat: 36.79, lng: 127.0 };
        const map = new kakao.maps.Map(box.current, {
          center: new kakao.maps.LatLng(c.lat, c.lng),
          level: level ?? 4,
        });
        mapRef.current = map;
        setState('ok');
        if (onPick) {
          kakao.maps.event.addListener(map, 'click', (e) => onPick(e.latLng.getLat(), e.latLng.getLng()));
        }
      })
      .catch(() => !dead && setState('error'));
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // 마커 · 점선
  useEffect(() => {
    const map = mapRef.current;
    const kakao = window.kakao;
    if (state !== 'ok' || !map || !kakao) return;
    layers.current.forEach((l) => l.setMap(null));
    layers.current = [];
    const valid = points.filter((p) => p.lat != null && p.lng != null);
    if (valid.length > 1) {
      const line = new kakao.maps.Polyline({
        path: valid.map((p) => new kakao.maps.LatLng(p.lat, p.lng)),
        strokeWeight: 3,
        strokeColor: getComputedStyle(document.documentElement).getPropertyValue('--c-primary').trim() || '#7A4E26',
        strokeOpacity: 0.7,
        strokeStyle: 'dash',
      });
      line.setMap(map);
      layers.current.push(line);
    }
    valid.forEach((p) => {
      const el = document.createElement('div');
      el.innerHTML = markerHtml(p, p.id === activeId);
      el.title = p.title ?? '';
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `${p.label}번 ${p.title ?? ''}`);
      if (onMarkerClick) el.onclick = () => onMarkerClick(p);
      const ov = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(p.lat, p.lng), content: el, yAnchor: 0.5, zIndex: 3 });
      ov.setMap(map);
      layers.current.push(ov);
    });
    if (pick?.lat != null) {
      const m = new kakao.maps.Marker({ position: new kakao.maps.LatLng(pick.lat, pick.lng) });
      m.setMap(map);
      layers.current.push(m);
    }
    if (valid.length > 1 && !pick) {
      const b = new kakao.maps.LatLngBounds();
      valid.forEach((p) => b.extend(new kakao.maps.LatLng(p.lat, p.lng)));
      map.setBounds(b, 40, 40, 40, 40);
    } else if (valid.length === 1 && !pick) {
      map.setCenter(new kakao.maps.LatLng(valid[0].lat, valid[0].lng));
    }
  }, [state, points, activeId, pick, onMarkerClick]);

  // 내 위치 (허용 시)
  useEffect(() => {
    if (!showMe || state !== 'ok' || !navigator.geolocation) return undefined;
    let ov = null;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const kakao = window.kakao;
        const pos = new kakao.maps.LatLng(p.coords.latitude, p.coords.longitude);
        if (!ov) {
          const el = document.createElement('div');
          el.innerHTML = '<div style="width:16px;height:16px;border-radius:50%;background:#2F6FDE;border:3px solid #fff;box-shadow:0 0 0 6px rgba(47,111,222,.25)"></div>';
          ov = new kakao.maps.CustomOverlay({ position: pos, content: el, zIndex: 4 });
          ov.setMap(mapRef.current);
        } else ov.setPosition(pos);
      },
      () => {},
      { maximumAge: 30000, timeout: 15000 },
    );
    return () => {
      navigator.geolocation.clearWatch(id);
      ov?.setMap(null);
    };
  }, [showMe, state]);

  return (
    <div className={`relative overflow-hidden rounded-[var(--r-card)] border border-line bg-sunk ${className}`} style={{ height }}>
      <div ref={box} className="absolute inset-0" aria-label="지도" />
      {state === 'loading' && <div className="absolute inset-0 grid place-items-center small muted">지도를 불러오는 중…</div>}
      {state === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center" role="alert">
          <p className="font-semibold">지도를 불러오지 못했어요</p>
          <button className="btn btn-secondary btn-sm" onClick={retry}>
            다시 시도
          </button>
          {fallback && <p className="small muted">{fallback}</p>}
        </div>
      )}
    </div>
  );
}

/** 길찾기: 카카오맵 앱이 있으면 앱, 없으면 웹 (현재 위치 → 대표 좌표) */
export function directionsUrl(name, lat, lng) {
  return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;
}
