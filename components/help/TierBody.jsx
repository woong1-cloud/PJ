import { TIER_LABELS } from '@/lib/tiers';

// 등급별로 무엇을 할 수 있는지. lib/tiers.js 의 canProcess/canManageBrand
// 규칙을 사람 말로 옮긴 것이다 — 그쪽 기준을 바꾸면 여기도 함께 고쳐야 한다.
//
// 낮은 등급부터 보여준다. 대부분의 사용자가 4차(요청자)이고, 자기 줄을
// 먼저 찾는 것이 이 표를 여는 이유이기 때문이다.
const TIER_ROWS = [
  { tier: '4차', can: '요구사항을 등록하고 진행 상황을 봅니다.' },
  { tier: '3차', can: '위에 더해 상태 변경, 담당자 지정, 배포예상일 입력을 합니다.' },
  { tier: '2차', can: '위에 더해 브랜드 팀원 배치와 카테고리 관리를 합니다.' },
  { tier: '1차', can: '모든 브랜드를 오가며 브랜드·프로젝트·계정을 관리합니다.' },
];

export function TierBody() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm break-keep text-slate-600">
        등급은 브랜드마다 따로 정해집니다. 한 브랜드에서 실무자여도 다른 브랜드에서는 요청자일 수
        있습니다.
      </p>

      {/* StatusBody 와 같은 모양이다. 도움말 안에서 목록이 두 가지 문법으로
          보이면 그것만으로 정리가 안 된 인상이 된다. */}
      <ul className="divide-y divide-slate-100 border-y border-slate-100">
        {TIER_ROWS.map((row) => (
          <li
            key={row.tier}
            className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-4"
          >
            <span className="shrink-0 sm:w-28">
              <span className="font-medium text-slate-900">{TIER_LABELS[row.tier]}</span>
              <span className="ml-1.5 text-xs text-slate-400">{row.tier}</span>
            </span>
            <span className="flex-1 text-sm break-keep text-slate-600">{row.can}</span>
          </li>
        ))}
      </ul>

      <p className="text-xs break-keep text-slate-400">
        메뉴나 버튼이 보이지 않는다면 그 브랜드에서의 등급이 낮기 때문입니다. 브랜드 관리자에게
        문의하세요.
      </p>
    </div>
  );
}
