'use client';

import { useEffect } from 'react';

// 서비스워커를 한 번 등록한다. 화면에 아무것도 안 그린다.
//
// 실패해도 조용히 넘어간다. 설치는 편의이고, 실패를 배너로 띄우면 "앱이
// 고장났나"로 읽힌다 — TaskActivity 의 멘션 자동완성이 같은 판단이다.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  return null;
}
