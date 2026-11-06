'use client';

export class ApiError extends Error {
  constructor(status, code, data) {
    super(code);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/** 사용자 API 호출. token을 주면 x-chak-token 헤더로 보냄 */
export async function api(path, { method = 'GET', token, body, signal } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { 'x-chak-token': token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal,
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) {
    if (data?.error === 'SERVER_ERROR') console.error('[api]', path, data);
    throw new ApiError(res.status, data?.error ?? 'SERVER_ERROR', data);
  }
  // 저장·삭제가 성공하면 기억해 둔 화면 데이터를 모두 버림 (옛 데이터가 보이지 않게)
  if (method !== 'GET') clearApiCache();
  return data;
}

/*
 * 화면 데이터 기억 (이 폰의 메모리에만, 새로고침하면 사라짐)
 * - 다시 들어간 화면은 기억한 데이터를 바로 보여 주고, 뒤에서 새 데이터를 받아 바꿈
 * - 키링마다 따로 기억 (키 = 키링 코드 + 주소)
 */
const store = new Map();
const inflight = new Map();
const MAX_ENTRIES = 100;
let generation = 0;

const keyOf = (path, token) => `${token ?? ''} ${path}`;

export function clearApiCache() {
  generation += 1;
  store.clear();
  inflight.clear();
}

function fetchAndStore(path, token) {
  const k = keyOf(path, token);
  const running = inflight.get(k);
  if (running) return running;
  const gen = generation;
  const p = api(path, { token })
    .then((data) => {
      if (gen === generation) {
        store.delete(k);
        store.set(k, { data, at: Date.now() });
        if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value);
      }
      return data;
    })
    .finally(() => {
      if (inflight.get(k) === p) inflight.delete(k);
    });
  inflight.set(k, p);
  return p;
}

/**
 * GET 전용. 기억한 데이터가 있으면 onCached로 먼저 넘기고, 새 데이터로 resolve.
 * 새로 받기에 실패해도 기억한 데이터가 있으면 그것으로 resolve (오류 화면 대신).
 */
export async function cachedApi(path, { token, onCached } = {}) {
  const hit = store.get(keyOf(path, token));
  if (hit && onCached) onCached(hit.data);
  try {
    return await fetchAndStore(path, token);
  } catch (e) {
    if (hit) return hit.data;
    throw e;
  }
}

/** 누르기 직전(손가락이 닿을 때) 다음 화면 데이터를 미리 받아 둠 */
export function prefetchApi(path, { token } = {}) {
  const hit = store.get(keyOf(path, token));
  if (hit && Date.now() - hit.at < 10_000) return;
  fetchAndStore(path, token).catch(() => {});
}

/** 13장 사용자 문구 */
export function errorText(e, t) {
  switch (e?.code) {
    case 'UNKNOWN_TOKEN':
      return '등록되지 않은 키링이에요';
    case 'LOST_TOKEN':
      return '이 키링은 사용이 중지되었어요. 새 키링으로 기록이 옮겨졌다면 새 키링을 대 주세요';
    case 'BLOCKED': {
      const until = e.data?.until ? new Date(e.data.until) : null;
      const min = until ? Math.max(1, Math.ceil((until - Date.now()) / 60000)) : null;
      return min && min < 600
        ? `코드를 여러 번 잘못 입력했어요. ${min}분 뒤에 다시 시도해 주세요`
        : '코드를 여러 번 잘못 입력해 이용이 제한되었어요. 안내소에 문의해 주세요';
    }
    case 'NETWORK':
      return '인터넷 연결을 확인하고 다시 시도해 주세요';
    case 'NOT_FOUND':
      return `찾는 ${t?.place ?? '정보'}가 없어요`;
    default:
      return '잠시 문제가 생겼어요. 조금 뒤 다시 시도해 주세요';
  }
}
