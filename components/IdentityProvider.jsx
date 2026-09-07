'use client';

import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { clearIdentity, loadIdentity, saveIdentity, subscribeIdentity } from '@/lib/identity';
import { createClient } from '@/lib/supabaseBrowser';

const IdentityContext = createContext(null);

// Identity lives in localStorage, an external (non-React) source of truth.
//
// 예전에는 saveIdentity 뒤에 늘 전체 이동이 따라와서 구독이 필요 없었다.
// 지금은 아래 effect 가 화면을 켠 채로 /api/me 를 다시 읽어 갱신하므로,
// 그 변화를 여기서 받아야 화면이 따라온다.
function subscribeToIdentity(onChange) {
  return subscribeIdentity(onChange);
}

function getServerIdentitySnapshot() {
  return null;
}

export function IdentityProvider({ children }) {
  const router = useRouter();
  const identity = useSyncExternalStore(subscribeToIdentity, loadIdentity, getServerIdentitySnapshot);

  useEffect(() => {
    // Read localStorage directly here rather than trusting the `identity`
    // render value: on a hard navigation straight to a page under this
    // provider, the first render uses the SSR/hydration snapshot (always
    // null), and this effect can fire before useSyncExternalStore's
    // post-hydration correction lands. Checking storage directly avoids
    // redirecting away from a valid session during that window.
    if (!loadIdentity()) {
      router.replace('/login');
    }
  }, [router]);

  // 화면을 켤 때 한 번 다시 읽는다.
  //
  // 로그인 때 담은 값은 그 순간의 사진이다. 런칭 명단에 넣어도, 등급이
  // 바뀌어도, 조직이 옮겨져도 재로그인 전까지 화면이 옛 값을 믿는다 —
  // 실제로 명단에 넣은 사람이 '런칭' 메뉴를 못 봤다.
  //
  // 전체 이동마다 한 번이라 요청이 많지 않다. 실패하면 아무것도 안 한다 —
  // 잠깐 네트워크가 끊겼다고 로그인 화면으로 쫓아내면 더 나쁘다.
  useEffect(() => {
    let alive = true;
    (async () => {
      const cur = loadIdentity();
      if (!cur) return;
      const res = await fetch('/api/me').catch(() => null);
      if (!alive || !res?.ok) return;
      const me = await res.json().catch(() => null);
      if (!alive || !me) return;

      // 브랜드·등급은 여기서 안 건드린다. 그건 로그인 때 고른 것이고
      // /api/me 는 그 선택을 모른다 — 덮어쓰면 보던 브랜드가 튄다.
      const next = {
        ...cur,
        name: me.name ?? cur.name,
        isGlobalAdmin: me.isGlobalAdmin === true,
        hasLaunch: me.hasLaunch === true,
      };
      // 같으면 안 쓴다. 안 그러면 저장 → 알림 → 다시 그림이 매번 돈다.
      if (JSON.stringify(next) !== JSON.stringify(cur)) saveIdentity(next);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearIdentity();
    router.replace('/login');
  }

  if (!identity) {
    return <div className="p-6 text-sm text-slate-500">불러오는 중...</div>;
  }

  return (
    <IdentityContext.Provider value={{ identity, logout }}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity() {
  const context = useContext(IdentityContext);
  if (!context) {
    throw new Error('useIdentity는 IdentityProvider 내부에서만 사용할 수 있습니다.');
  }
  return context;
}
