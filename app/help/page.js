import { HelpSection } from '@/components/help/HelpSection';
import { HelpToc } from '@/components/help/HelpToc';
import { AboutBody } from '@/components/help/AboutBody';
import { StatusBody } from '@/components/help/StatusBody';
import { TierBody } from '@/components/help/TierBody';
import { HELP_SECTIONS } from '@/lib/helpSections';
import { APP_NAME } from '@/lib/branding';

// 섹션 본문은 여기에 없다. 이 파일은 목차와 껍데기만 그린다.
//
// 내용을 더할 때 하는 일은 둘이다 — lib/helpSections.js 에 항목 한 줄을 넣고,
// 본문 컴포넌트를 하나 만들어 아래 BODIES 에 연결한다. 목차는 저절로 늘어난다.
const BODIES = {
  about: AboutBody,
  status: StatusBody,
  tier: TierBody,
};

// 로그인한 사람이면 누구나 볼 수 있다.
//
// 원래 상태 안내가 대시보드에 있었는데, 대시보드는 전체관리자 전용이다.
// 정작 "검토대기가 무슨 뜻이지?"가 궁금한 사람은 요청을 올리는 브랜드
// 담당자(4차)인데 그 화면에 들어갈 수 없었다. 설명이 필요 없는 사람에게만
// 설명이 보이던 셈이라 이리로 옮겼다.
export default function HelpPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 break-keep">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">도움말</h1>
        <p className="mt-1 text-sm text-slate-500">
          {APP_NAME}를 어떻게 쓰는 곳인지, 상태와 권한이 무슨 뜻인지 모았습니다.
        </p>
      </header>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
        <HelpToc sections={HELP_SECTIONS} />

        {/* min-w-0 이 없으면 안쪽의 긴 문장이 flex 아이템을 밀어 목차를 찌그러뜨린다. */}
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {HELP_SECTIONS.map((section) => {
            const Body = BODIES[section.id];
            if (!Body) return null;
            return (
              <HelpSection
                key={section.id}
                id={section.id}
                title={section.title}
                summary={section.summary}
              >
                <Body />
              </HelpSection>
            );
          })}
        </div>
      </div>
    </div>
  );
}
