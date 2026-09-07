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

// 바뀌었다고 알릴 곳들.
//
// 예전에는 saveIdentity 뒤에 늘 전체 이동이 따라와서 구독이 필요 없었다.
// 지금은 화면을 켠 채로 /api/me 를 다시 읽어 갱신하므로, 알리지 않으면
// localStorage 만 바뀌고 화면은 옛 값 그대로다.
const listeners = new Set();

function notify() {
  for (const fn of listeners) fn();
}

export function subscribeIdentity(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function saveIdentity(identity) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  notify();
}

export function clearIdentity() {
  window.localStorage.removeItem(STORAGE_KEY);
  notify();
}

// 브랜드를 바꿀 때 tier 도 반드시 함께 바꾼다. 등급은 브랜드마다 다르다 —
// 스파오에서 2차인 사람이 미쏘에서는 4차일 수 있다. brandId 만 갈아끼우면
// 권한이 잘못 계산된다.
export function switchBrand(identity, brandId, tier) {
  saveIdentity({ ...identity, brandId, tier });
}
