import { StatusGuide } from '@/components/StatusGuide';
import { TierGuide } from '@/components/TierGuide';

// 로그인한 사람이면 누구나 볼 수 있다.
//
// 원래 상태 안내가 대시보드에 있었는데, 대시보드는 전체관리자 전용이다.
// 정작 "검토대기가 무슨 뜻이지?"가 궁금한 사람은 요청을 올리는 브랜드
// 담당자(4차)인데 그 화면에 들어갈 수 없었다. 설명이 필요 없는 사람에게만
// 설명이 보이던 셈이라 이리로 옮겼다.
export default function HelpPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <h1 className="text-lg font-semibold text-slate-900">도움말</h1>
      <StatusGuide />
      <TierGuide />
    </div>
  );
}
