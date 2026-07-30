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

export function TierGuide() {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-medium text-slate-900">권한 등급</h2>
        <p className="mt-1 text-sm text-slate-500">
          등급은 브랜드마다 따로 정해집니다. 한 브랜드에서 실무자여도 다른
          브랜드에서는 요청자일 수 있습니다.
        </p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="w-32 py-2">등급</th>
            <th className="py-2">할 수 있는 일</th>
          </tr>
        </thead>
        <tbody>
          {TIER_ROWS.map((row) => (
            <tr key={row.tier} className="border-b border-slate-100">
              <td className="py-2">
                <span className="font-medium text-slate-900">{TIER_LABELS[row.tier]}</span>
                <span className="ml-1.5 text-xs text-slate-400">{row.tier}</span>
              </td>
              <td className="py-2 text-slate-600">{row.can}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-xs text-slate-400">
        메뉴나 버튼이 보이지 않는다면 그 브랜드에서의 등급이 낮기 때문입니다.
        브랜드 관리자에게 문의하세요.
      </p>
    </section>
  );
}
