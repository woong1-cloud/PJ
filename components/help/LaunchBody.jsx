import { LAUNCH_STATUSES } from '@/lib/launchTask';

// 런칭 화면을 처음 여는 사람에게.
//
// 브랜드 사람이 471건을 처음 열면 '착수 가능' · '풀림 12' · '선행조건' ·
// '해당없음' 이 뭔지 어디에도 설명이 없었다. 요구사항 쪽은 도움말이 있는데
// 런칭은 절이 통째로 없었다.
//
// 화면 순서대로 쓴다 — 위에서 아래로 훑으면 그게 곧 첫날의 동선이다.

const WORDS = [
  {
    term: '착수 가능',
    body: '지금 바로 시작할 수 있는 것. 선행조건이 다 끝났고 아직 손대지 않은 항목입니다. 화면을 열면 여기부터 보입니다.',
  },
  {
    term: '선행조건',
    body: '이것이 끝나야 내 일을 시작할 수 있는 항목. 줄 아래에 제목·주관·기한이 함께 나오고, 눌러서 그 항목으로 갈 수 있습니다.',
  },
  {
    term: '풀림 12',
    body: '이 항목을 끝내면 12건이 시작할 수 있게 된다는 뜻. 기한이 같은 둘 중 무엇을 먼저 할지 이 숫자가 정합니다.',
  },
  {
    term: '해당없음',
    body: '완료와 다릅니다. 완료는 끝난 것이고 해당없음은 이 브랜드에서는 애초에 안 하는 일입니다. 사유를 꼭 적습니다 — 다음 브랜드가 "왜 뺐지"에 답해야 합니다. 진척률 분모에서도 빠집니다.',
  },
  {
    term: 'D-day',
    body: '오픈일 기준 며칠 전인지. D-90 은 오픈 90일 전입니다. 날짜를 저장하지 않고 오픈일에서 계산하기 때문에, 오픈일이 밀리면 모든 기한이 함께 움직입니다.',
  },
  {
    term: '주관 · 지원 · 결정권',
    body: '주관은 그 일을 하는 팀, 지원은 도와야 하는 팀, 결정권은 막혔을 때 정해 줄 팀입니다.',
  },
];

const TABS = [
  ['보드', '항목 목록. 역할·담당자로 걸러 보고 상태를 바꿉니다.'],
  ['결정 대기', '누가 정해 줘야 넘어가는 것들. 막힘을 걸면 여기로 모입니다.'],
  ['주간 진척', '워크스트림별 완료율·지남·막힘. 주간 회의에서 보는 화면입니다.'],
  ['간트', '언제 몰리는지. 막대를 누르면 그 워크스트림만 보드에서 열립니다.'],
];

export function LaunchBody() {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-slate-600">
        신규 브랜드를 온라인에 여는 일을 한 곳에서 봅니다. 법인 설립부터 오픈 다음 날 정산까지
        수백 건이 들어 있고, <b className="text-slate-800">각자 자기 역할의 것만 골라 보면 됩니다.</b>
      </p>

      <div>
        <h3 className="mb-2 text-sm font-medium text-slate-800">처음 열었다면</h3>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-slate-600">
          <li>
            위쪽 띠에서 <b className="text-slate-800">내 역할을 고릅니다.</b> 옆의 초록 숫자가 그
            역할이 지금 시작할 수 있는 건수입니다. 한 번 고르면 다시 묻지 않습니다.
          </li>
          <li>
            <b className="text-slate-800">착수 가능</b> 목록이 기한 이른 순으로 나옵니다. 이번 주에
            할 것이 아니라 <b className="text-slate-800">지금 시작할 수 있는 것</b>입니다.
          </li>
          <li>
            내가 맡을 항목을 열어 <b className="text-slate-800">담당자에 자기 이름을 붙입니다.</b>{' '}
            그래야 나중에 그 항목에 대한 연락이 갑니다.
          </li>
          <li>
            일이 끝나면 상태를 <b className="text-slate-800">완료</b>로. 남이 정해 줘야 넘어가면{' '}
            <b className="text-slate-800">막힘</b>으로 두고 어느 팀이 정할지 고릅니다.
          </li>
        </ol>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-slate-800">상태 다섯</h3>
        <p className="text-sm text-slate-600">
          {LAUNCH_STATUSES.join(' · ')}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          해당없음은 <b>⋯ 메뉴</b>에 있습니다 — 자주 쓰는 것이 아니라 단추 줄에 안 뒀습니다.
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-slate-800">탭 넷</h3>
        <ul className="divide-y divide-slate-100 border-y border-slate-100">
          {TABS.map(([name, what]) => (
            <li key={name} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-3">
              <span className="w-24 shrink-0 text-sm font-medium text-slate-800">{name}</span>
              <span className="text-sm text-slate-600">{what}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-slate-800">화면에 나오는 말</h3>
        <ul className="divide-y divide-slate-100 border-y border-slate-100">
          {WORDS.map(({ term, body }) => (
            <li key={term} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-3">
              <span className="w-24 shrink-0 text-sm font-medium text-slate-800">{term}</span>
              <span className="text-sm text-slate-600">{body}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
        <b className="text-slate-800">안 보이는 것이 있다면</b> — 엑셀 가져오기·내보내기, 항목
        지우기, 참여자 명단은 전체 관리자만 합니다. 필요하면 전체 관리자에게 말씀해 주세요.
      </div>
    </div>
  );
}
