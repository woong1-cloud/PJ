'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 1단계에서는 런칭 목록이 아직 없다. 가이드로 보낸다.
//
// 상단바 링크를 /launch/guide 로 직접 걸지 않는 이유: 1-C 에서 여기가
// 런칭 목록이 되면 링크를 다시 고쳐야 하고, 그때 메일이나 북마크에 남은
// 주소가 어긋난다. 입구는 처음부터 /launch 로 고정한다.
export default function LaunchPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/launch/guide');
  }, [router]);
  return <p className="text-sm text-slate-500">여는 중...</p>;
}
