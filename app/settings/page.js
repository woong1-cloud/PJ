'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useIdentity } from '@/components/IdentityProvider';
import { settingsItemsFor } from '@/lib/settingsNav';

// 주소만 /settings 로 들어온 사람을 첫 화면으로 보낸다.
//
// 무엇이 첫 줄인지는 권한에 달렸다 — 4차는 「내 정보」, 전체관리자도
// 「내 정보」지만 목록이 바뀌면 따라간다. 여기에 주소를 직접 적으면
// lib/settingsNav.js 와 갈라진다.
export default function SettingsIndexPage() {
  const { identity } = useIdentity();
  const router = useRouter();
  const first = settingsItemsFor(identity)[0]?.href;

  useEffect(() => {
    if (first) router.replace(first);
  }, [first, router]);

  return null;
}
