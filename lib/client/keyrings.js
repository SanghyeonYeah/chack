'use client';
/**
 * 이 폰에 연결된 키링 목록 (B7)
 * - 웹별로 따로, 최대 5개, 최근 쓴 순서. 맨 앞 = 기본 키링
 * - 모든 localStorage 접근은 try/catch (사파리 개인 정보 보호 모드 등)
 */
const MAX = 5;
const key = (service, name) => `chak.${service}.${name}`;

function read(k, fallback) {
  try {
    const raw = localStorage.getItem(k);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function write(k, v) {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* 저장 불가 */
  }
}

export function getKeyrings(service) {
  const list = read(key(service, 'keyrings'), []);
  return Array.isArray(list) ? list.filter((c) => typeof c === 'string') : [];
}

export function primaryKeyring(service) {
  return getKeyrings(service)[0] ?? null;
}

/** 맨 앞으로 올림. 반환: { list, isNew, others } */
export function rememberKeyring(service, code) {
  const prev = getKeyrings(service);
  const isNew = !prev.includes(code);
  const list = [code, ...prev.filter((c) => c !== code)].slice(0, MAX);
  write(key(service, 'keyrings'), list);
  notify(service);
  return { list, isNew, others: list.length - 1 };
}

export function removeKeyring(service, code) {
  const list = getKeyrings(service).filter((c) => c !== code);
  write(key(service, 'keyrings'), list);
  notify(service);
  return list;
}

export function getFlag(service, name) {
  return read(key(service, name), null);
}
export function setFlag(service, name, value) {
  write(key(service, name), value);
}

const EVT = 'chak-keyrings';
function notify(service) {
  try {
    window.dispatchEvent(new CustomEvent(EVT, { detail: service }));
  } catch {
    /* noop */
  }
}
export function onKeyringsChange(fn) {
  const h = () => fn();
  window.addEventListener(EVT, h);
  window.addEventListener('storage', h);
  return () => {
    window.removeEventListener(EVT, h);
    window.removeEventListener('storage', h);
  };
}
