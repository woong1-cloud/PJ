'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useIdentity } from '@/components/IdentityProvider';
import { isSettingsPathAllowed } from '@/lib/settingsNav';

// 남의 설정 화면을 주소로 직접 연 사람을 되돌린다. 아무것도 그리지 않는다.
//
// 페이지들이 각자 들고 있는 문지기와 겹치지 않는다. 그쪽은 「이 사람이
// 브랜드를 관리할 수 있나」를 보고 /requirements 로 보낸다 — 권한 자체의
// 문제다. 이쪽은 「이 설정 화면이 이 사람 레일에 있나」를 본다. 레일에 없는
// 줄을 주소로 찍어서 들어오면, 페이지가 한 번 그려지면서 「권한이
// 없습니다」가 번쩍인 뒤에야 옮겨 간다. 그 번쩍임을 없애는 것이 여기 일이다.
//
// /settings 는 목록에 없지만 막지 않는다. 그 화면이 하는 일이 바로 첫 줄로
// 보내는 것이라, 여기서 먼저 쫓아내면 두 리다이렉트가 겹친다.
export function SettingsGuard() {
  const { identity } = useIdentity();
  const router = useRouter();
  const pathname = usePathname();

  const allowed = pathname === '/settings' || isSettingsPathAllowed(identity, pathname);

  useEffect(() => {
    if (!allowed) router.replace('/settings/profile');
  }, [allowed, router]);

  return null;
}
