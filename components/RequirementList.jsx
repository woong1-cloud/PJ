import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { DONE_STATUS, MERGED_STATUS } from '@/lib/statuses';
import { statusStyle } from '@/lib/statusMeta';
import { isOverdue } from '@/lib/overdue';
import { redmineLinkState } from '@/lib/redmineLink';
import { REQUIREMENT_TYPES } from '@/lib/requirementTypes';

function StatusBadge({ status }) {
  return <Badge className={statusStyle(status)}>{status}</Badge>;
}

function ConfidentialBadge() {
  return <Badge className="bg-rose-50 text-rose-600">비공개</Badge>;
}

function Meta({ req }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-400">
      {/* 프로젝트는 컬럼이 아니라 제목 아래 줄이다. 컬럼으로 만들면 이미 8개인
          표에 9번째가 붙는데, 폭이 밀리는 건 결국 max-w-0 인 제목 칸이다.
          프로젝트에 안 묶인 건도 많아서 담당자 컬럼을 뺐던 것과 같은 문제
          (대부분 빈칸)가 반복된다. 여기 있으면 있는 줄에만 보인다. */}
      {req.project?.name && (
        <span className="max-w-[16rem] truncate text-slate-500" title={req.project.name}>
          {req.project.name}
        </span>
      )}
      {req.is_confidential && <ConfidentialBadge />}
      {req.image_count > 0 && <span>📎 {req.image_count}</span>}
      {/* 레드마인 인계 상태. 'none'(아직 넘길 단계 아님)이면 아무것도 안 그린다 —
          작성중·검토대기에까지 배지를 깔면 목록 전체가 배지밭이 되고, 정작
          봐야 할 개발중 건에서 눈에 안 들어온다. */}
      {redmineLinkState(req) === 'linked' && <span className="text-slate-500">↗ 레드마인</span>}
      {redmineLinkState(req) === 'missing' && (
        <span className="rounded bg-amber-50 px-1.5 text-amber-700">미연결</span>
      )}
      {req.status === MERGED_STATUS && <span>→ 병합됨</span>}
    </span>
  );
}

// 표 안에서 쓰는 작은 셀렉트.
//
// 목록에서 값을 바꾸지 못하면 담당자 없는 6건을 채우려고 6번 들어갔다 나와야
// 한다. 그게 지금 이 툴에서 가장 자주 하는 일인데 가장 느리다.
//
// 상세의 Select 컴포넌트를 쓰지 않고 기본 select 를 쓴다 — 표 안에 40px 짜리
// 트리거가 줄마다 들어가면 행 높이가 두 배가 되고, 훑는 화면이 아니게 된다.
//
// 평소에는 그냥 글자로 보이고, 마우스를 올렸을 때만 편집 가능한 칸처럼
// 보인다. 이유가 둘이다.
//
// 첫째, 브라우저가 그리는 화살표를 지운다(appearance-none). 유형 칸은 폭이
// 좁은데 화살표가 16px 을 먹어서 '신규' 와 겹쳤다. 폭을 늘려 피하는 대신
// 화살표를 없애면 애초에 겹칠 것이 없다.
//
// 둘째, 목록은 열에 아홉은 읽는 화면이다. 줄마다 테두리와 화살표가 서 있으면
// 표가 아니라 폼으로 읽힌다. 편집은 손을 뻗은 순간에만 보이면 된다.
//
// 이 표는 md 이상에서만 그려지므로(모바일은 카드) hover 가 없는 환경은
// 신경 쓰지 않아도 된다. 모바일에서는 상세 화면에서 같은 값을 바꾼다.
// focus-within 을 같이 두는 이유는 키보드로 탭해 온 사람에게도 같은 표시가
// 필요하기 때문이다.
function CellSelect({ value, options, onChange, placeholder }) {
  return (
    <div className="group/cell relative -mx-1 rounded transition-colors hover:bg-white hover:ring-1 hover:ring-slate-300 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-400">
      {/* pr-4 는 화살표가 없을 때도 자리를 비워 둔다. 안 그러면 마우스를
          올리는 순간 글자가 왼쪽으로 밀려 칸이 덜컹인다. */}
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="w-full cursor-pointer appearance-none rounded border-0 bg-transparent px-1 py-0.5 pr-4 text-sm text-slate-600 focus:outline-none"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-1 -translate-y-1/2 text-[10px] text-slate-400 opacity-0 transition-opacity group-hover/cell:opacity-100 group-focus-within/cell:opacity-100"
      >
        ▾
      </span>
    </div>
  );
}

const PRIORITY_STYLES = { 상: 'text-rose-600', 중: 'text-amber-600', 하: 'text-slate-400' };

// 미완료면 예상일, 완료면 완료일. 두 컬럼으로 나누면 대부분 빈칸이 된다.
function DateCell({ req, today }) {
  if (req.status === DONE_STATUS && req.completed_at) {
    return <span className="text-slate-500">{req.completed_at.slice(5, 10)} 완료</span>;
  }
  if (!req.expected_release_date) return <span className="text-slate-400">—</span>;
  const short = req.expected_release_date.slice(5);
  if (isOverdue(req.expected_release_date, req.status, today)) {
    return <span className="font-medium text-rose-600">⚠ {short} 지연</span>;
  }
  return <span className="text-slate-500">{short} 예정</span>;
}

function SortableTh({ label, sortKey, sort, onSort, className = '' }) {
  const active = sort?.key === sortKey;
  return (
    <th className={`px-3 py-2 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-slate-900"
      >
        {label}
        <span className={active ? 'text-slate-900' : 'text-slate-300'}>
          {active && sort.dir === 'asc' ? '↑' : '↓'}
        </span>
      </button>
    </th>
  );
}

// props: requirements, sort, onSort, today, onMerge, teamMembers, onPatch
//
// onPatch(id, patch) 를 주면 유형·담당자 칸이 편집 가능해진다. 3차 미만에게는
// 주지 않는다 — 서버가 어차피 막지만, 눌러서 403 을 받는 길을 만들지 않는다.
//
// onMerge 를 주면 중복처리 열이 생긴다. 목록이 기본 뷰인데 중복처리가 보드에만
// 있어서, 목록으로 훑다가 같은 요청 둘을 발견하면 보드로 옮겨 가야 했다.
// 3차 미만에게는 주지 않는다(병합은 IT 판단이다).
export function RequirementList({
  requirements,
  sort,
  onSort,
  today,
  onMerge,
  teamMembers = [],
  onPatch,
}) {
  if (requirements.length === 0) {
    return <p className="text-sm text-slate-500">등록된 요구사항이 없습니다.</p>;
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              {/* 채널이 맨 앞이다. "어느 채널 건인가"는 줄을 묶어 읽는 기준이라
                  왼쪽 끝에 있을 때 목록이 채널별로 훑어진다. 카테고리 칸에
                  '미분류 · 공통' 처럼 붙여봤더니 한 덩어리로 읽혀서 아무도
                  채널로 인식하지 못했다. */}
              <th className="w-20 px-3 py-2">채널</th>
              {/* 유형은 값이 2글자 고정이라 좁은 칸에 딱 맞는다. 제목 아래
                  줄에 배지로 두면 프로젝트명·첨부 표시와 섞여 눈에 안 든다 —
                  짧은 고정값은 컬럼, 긴 자유값은 제목 아래가 기준이다. */}
              <th className="w-20 px-3 py-2">유형</th>
              <SortableTh label="상태" sortKey="status" sort={sort} onSort={onSort} className="w-24" />
              <th className="px-3 py-2">제목</th>
              <th className="w-28 px-3 py-2">카테고리</th>
              <SortableTh label="우선" sortKey="priority" sort={sort} onSort={onSort} className="w-16" />
              {/* 담당자를 되살렸다. 예전에 뺀 이유가 "배정 전인 건이 대부분이라
                  거의 비어 있다"였는데, 지금은 그게 정확히 문제다 — 비어 있으니
                  채워야 하고, 채우는 자리가 목록에 있어야 빠르다. */}
              <th className="w-24 px-3 py-2">담당자</th>
              <th className="w-20 px-3 py-2">요청자</th>
              {/* 기본 정렬 기준이라 헤더가 있어야 한다. 다른 컬럼으로 정렬한 뒤
                  요청일 순서로 되돌아갈 방법이 없으면 정렬이 막다른 길이 된다. */}
              <SortableTh
                label="요청일"
                sortKey="request_date"
                sort={sort}
                onSort={onSort}
                className="w-24"
              />
              <SortableTh
                label="예상·완료"
                sortKey="expected_release_date"
                sort={sort}
                onSort={onSort}
                className="w-28"
              />
              {onMerge && <th className="w-16 px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {requirements.map((req) => (
              <tr
                key={req.id}
                className={`border-t border-slate-200 hover:bg-slate-50 ${
                  req.status === MERGED_STATUS ? 'opacity-60' : ''
                }`}
              >
                <td className="px-3 py-2 text-slate-500">{req.channel ?? '—'}</td>
                {/* 0019 이전 건은 값이 없다. 빈칸으로 두면 화면이 깨진 것처럼
                    보이므로 '—' 를 찍는다 — 다른 미지정 칸(예상·완료)과 같은 표기다. */}
                <td className="px-3 py-2 text-slate-500">
                  {onPatch ? (
                    <CellSelect
                      value={req.requirement_type}
                      placeholder="—"
                      options={REQUIREMENT_TYPES.map((t) => ({ value: t, label: t }))}
                      onChange={(v) => onPatch(req.id, { requirementType: v || null })}
                    />
                  ) : (
                    (req.requirement_type ?? <span className="text-slate-300">—</span>)
                  )}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={req.status} />
                </td>
                {/* max-w-0 + truncate 조합이 제목을 남은 폭에 맞춰 말줄임 처리한다. */}
                <td className="max-w-0 px-3 py-2 text-slate-900">
                  <Link
                    href={`/requirements/${req.id}`}
                    className="block truncate hover:underline"
                    title={req.title}
                  >
                    {req.title}
                  </Link>
                  <Meta req={req} />
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {req.category?.category_name ?? '미분류'}
                </td>
                <td className={`px-3 py-2 ${PRIORITY_STYLES[req.priority] ?? 'text-slate-400'}`}>
                  {req.priority ?? '—'}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {/* 유형 칸과 같은 '—' 를 쓴다. 같은 표에서 빈 값을 한 칸은
                      '—', 옆 칸은 '미지정' 으로 적으면 두 표기가 다른 뜻인
                      줄 알고 읽게 된다. */}
                  {onPatch ? (
                    <CellSelect
                      value={req.assignee?.id}
                      placeholder="—"
                      options={teamMembers.map((m) => ({ value: m.id, label: m.name }))}
                      onChange={(v) => onPatch(req.id, { assignee: v || null })}
                    />
                  ) : (
                    (req.assignee?.name ?? <span className="text-slate-300">—</span>)
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600">{req.requester?.name ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{req.request_date}</td>
                <td className="px-3 py-2 text-xs">
                  <DateCell req={req} today={today} />
                </td>
                {onMerge && (
                  <td className="px-3 py-2 text-right">
                    {/* 이미 병합된 건은 다시 병합할 수 없다. 버튼을 남겨 두면
                        눌러서 400 을 받는 길만 생긴다. */}
                    {req.status !== MERGED_STATUS && (
                      <button
                        type="button"
                        onClick={() => onMerge(req)}
                        className="whitespace-nowrap text-xs text-slate-500 underline hover:text-slate-700"
                      >
                        중복
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* 모바일 카드. 줄마다 역할이 고정된 네 줄이다.
          예전에는 마지막 한 줄에 값 예닐곱을 '·' 로 이어 붙였는데, 감기는
          위치가 데이터마다 달라 카드마다 높이와 모양이 제각각이었다. 게다가
          정작 담당자가 없었다 — 요청자가 폰을 꺼내 보는 이유는 "내 요청 어디까지
          왔나" 하나인데 그 답이 화면에 없었던 셈이다.
          네 줄 모두 항상 그린다. 넷째 줄의 요청자는 늘 있으므로 카드 높이가
          완전히 균일해진다. */}
      <div className="flex flex-col gap-3 md:hidden">
        {requirements.map((req) => (
          <Link
            key={req.id}
            href={`/requirements/${req.id}`}
            className={`block rounded-lg border border-slate-200 bg-white p-3 shadow-sm ${
              req.status === MERGED_STATUS ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <StatusBadge status={req.status} />
              <span className="shrink-0 text-xs">
                <DateCell req={req} today={today} />
              </span>
            </div>

            <p className="mt-2 line-clamp-2 font-medium text-slate-900">{req.title}</p>

            {/* 왼쪽은 분류, 오른쪽은 사람. 담당자에 '담당' 라벨을 붙이는 이유는
                표와 달리 카드에는 헤더가 없기 때문이다 — 이름만 떠 있으면 그게
                담당자인지 요청자인지 알 수 없다. */}
            <div className="mt-1.5 flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-slate-500">
                {req.requirement_type ?? '미분류'} · {req.channel ?? '—'}
              </span>
              <span
                className={`shrink-0 ${req.assignee?.name ? 'text-slate-700' : 'text-slate-400'}`}
              >
                담당 {req.assignee?.name ?? '미지정'}
              </span>
            </div>

            {/* 카테고리는 뺐다 — 대부분 '미분류'라 자리만 먹는다. */}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
              <span>{req.requester?.name ?? '—'} 요청</span>
              {req.image_count > 0 && <span>📎 {req.image_count}</span>}
              {req.project?.name && <span className="truncate">{req.project.name}</span>}
              {redmineLinkState(req) === 'missing' && (
                <span className="rounded bg-amber-50 px-1 text-amber-700">미연결</span>
              )}
              {req.is_confidential && <span className="text-rose-500">비공개</span>}
              {req.status === MERGED_STATUS && <span>→ 병합됨</span>}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
