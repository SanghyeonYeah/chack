// 화면 데이터 기억 (lib/client/api.js): 바로 보여 주기 · 키링별 분리 · 저장 후 비우기
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cachedApi, clearApiCache, api, prefetchApi } from '../lib/client/api.js';

let n = 0;
function mockFetch(fail = false) {
  globalThis.fetch = vi.fn(async (path, init) => {
    if (fail) throw new Error('offline');
    n += 1;
    return { ok: true, status: 200, json: async () => ({ ok: true, n, path, token: init.headers['x-chak-token'] ?? null }) };
  });
}

beforeEach(() => {
  n = 0;
  clearApiCache();
  mockFetch();
});

describe('cachedApi', () => {
  it('두 번째 방문은 기억한 데이터를 먼저 주고 새 데이터로 바꾼다', async () => {
    const first = await cachedApi('/api/sites/1', { token: 'AAAA2222' });
    expect(first.n).toBe(1);
    const seen = [];
    const fresh = await cachedApi('/api/sites/1', { token: 'AAAA2222', onCached: (d) => seen.push(d.n) });
    expect(seen).toEqual([1]);
    expect(fresh.n).toBe(2);
  });

  it('키링이 다르면 기억한 데이터를 섞지 않는다', async () => {
    await cachedApi('/api/sites/1', { token: 'AAAA2222' });
    const onCached = vi.fn();
    const d = await cachedApi('/api/sites/1', { token: 'BBBB3333', onCached });
    expect(onCached).not.toHaveBeenCalled();
    expect(d.token).toBe('BBBB3333');
  });

  it('새로 받기에 실패하면 기억한 데이터로 대신한다', async () => {
    await cachedApi('/api/regions');
    mockFetch(true);
    const d = await cachedApi('/api/regions');
    expect(d.n).toBe(1);
  });

  it('기억한 데이터가 없는데 실패하면 오류를 낸다', async () => {
    mockFetch(true);
    await expect(cachedApi('/api/regions')).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('저장·삭제가 성공하면 기억한 데이터를 비운다', async () => {
    await cachedApi('/api/visits/1', { token: 'AAAA2222' });
    await api('/api/visits/1/note', { method: 'PUT', token: 'AAAA2222', body: { body: 'x' } });
    const onCached = vi.fn();
    await cachedApi('/api/visits/1', { token: 'AAAA2222', onCached });
    expect(onCached).not.toHaveBeenCalled();
  });

  it('미리 받기와 화면 요청이 겹치면 한 번만 요청한다', async () => {
    prefetchApi('/api/sites/9');
    await cachedApi('/api/sites/9');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
