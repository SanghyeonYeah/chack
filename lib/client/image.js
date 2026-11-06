'use client';
/**
 * 사진 준비 (T-U-08): HEIC → JPG, 긴 변 1600px 축소, 5MB 이하 JPG
 */
const MAX_SIDE = 1600;
const MAX_BYTES = 5 * 1024 * 1024;

function isHeic(file) {
  return /hei[cf]$/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

async function toBitmapSource(file) {
  let blob = file;
  if (isHeic(file)) {
    const heic2any = (await import('heic2any')).default;
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    blob = Array.isArray(out) ? out[0] : out;
  }
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      /* 아래 img 방식 */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** @returns {Promise<{ blob: Blob, width: number, height: number }>} */
export async function prepareImage(file) {
  if (!/^image\//.test(file.type) && !isHeic(file)) throw new Error('NOT_IMAGE');
  const src = await toBitmapSource(file);
  const w0 = src.width;
  const h0 = src.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const width = Math.round(w0 * scale);
  const height = Math.round(h0 * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(src, 0, 0, width, height);
  src.close?.();
  for (const q of [0.85, 0.75, 0.6, 0.45]) {
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', q));
    if (blob && blob.size <= MAX_BYTES) return { blob, width, height };
  }
  throw new Error('TOO_LARGE');
}

/** 서명 업로드 주소로 PUT (진행률 콜백, 중지 가능) */
export function uploadBlob(url, blob, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', 'image/jpeg');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('NETWORK'));
    xhr.onabort = () => reject(Object.assign(new Error('ABORTED'), { name: 'AbortError' }));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}
