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
  return data;
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
