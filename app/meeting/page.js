'use client';

import { useIdentity } from '@/components/IdentityProvider';
import { canProcess } from '@/lib/tiers';
import { MeetingBoard } from '@/components/MeetingBoard';

// 주간회의 화면. 목요일에 이걸 띄워 놓고 회의를 한다.
//
// 목록 페이지에 '회의 모드' 버튼을 다는 안도 있었지만 새 주소로 뺐다. 목적이
// 분명한 주소여야 메일 링크가 바로 꽂히고, 처음 보는 사람도 이 화면이 무슨
// 자리인지 안다. 버튼은 모르면 안 눌린다.
//
// 화면 게이팅은 편의일 뿐이고 관문은 API 다(requireBrandAccess '3차').
export default function MeetingPage() {
  const { identity } = useIdentity();
  if (!canProcess(identity)) {
    return <p className="text-sm text-slate-500">실무자 이상만 볼 수 있는 화면입니다.</p>;
  }
  return <MeetingBoard identity={identity} />;
}
