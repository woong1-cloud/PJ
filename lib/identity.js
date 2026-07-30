const STORAGE_KEY = 'requirements-app-identity';

// Cache the last parsed value keyed by the raw localStorage string so
// `loadIdentity` returns a referentially stable result when the underlying
// value hasn't changed. This makes it safe to use directly as a
// `useSyncExternalStore` snapshot (React compares snapshots with
// `Object.is` and would otherwise re-render on every call).
let cachedRaw;
let cachedIdentity;

export function loadIdentity() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedIdentity;
  cachedRaw = raw;
  if (!raw) {
    cachedIdentity = null;
    return cachedIdentity;
  }
  try {
    cachedIdentity = JSON.parse(raw);
  } catch {
    cachedIdentity = null;
  }
  return cachedIdentity;
}

export function saveIdentity(identity) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

export function clearIdentity() {
  window.localStorage.removeItem(STORAGE_KEY);
}

// 브랜드를 바꿀 때 tier 도 반드시 함께 바꾼다. 등급은 브랜드마다 다르다 —
// 스파오에서 2차인 사람이 미쏘에서는 4차일 수 있다. brandId 만 갈아끼우면
// 권한이 잘못 계산된다.
export function switchBrand(identity, brandId, tier) {
  saveIdentity({ ...identity, brandId, tier });
}
