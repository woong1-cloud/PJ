'use client';

import { useState } from 'react';
import { PropertyRow } from '@/components/ui/PropertyRow';

// 오른쪽 열. 여기서 바꾸는 것 넷만 남긴다.
//
// 지금은 열 항목이 섞여 있어서 '요청 내용 · 수정에서 변경'이라는 변명 문구가
// 붙어 있다. 읽기 전용 값을 접으면 그 문구가 필요 없어진다 — 바꾸는 자리에
// 없으니 변명할 것이 없다.
//
// props:
//   assigneeFilled — 담당자가 지정돼 있는가. 색을 가진 행을 정한다
//   assigneeSlot, typeSlot, expectedSlot, projectSlot — 각 행의 컨트롤
//   redmineSlot — 행이 아니라 아래에 붙는 섹션이다
//   extras — 지정과 요청 내용 사이에 들어가는 블록들(하위 작업 · 연결)
// 상태 행은 없다. 머리 줄과 진행 스트립이 이미 상태를 말하는데 여기까지
// 두면 한 화면에 세 번 나오고, 게다가 이 자리에서는 바꿀 수도 없다.
//   request — { summary, rows: [[label, value], ...] }
export function RequirementSidebar({
  assigneeFilled,
  assigneeSlot,
  typeSlot,
  expectedSlot,
  redmineSlot,
  projectSlot,
  extras,
  request,
}) {
  const [openRequest, setOpenRequest] = useState(false);

  return (
    <aside className="flex flex-col gap-4 text-sm">
      <div>
        <p className="mb-2 text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
          지정
        </p>
        <div className="flex flex-col gap-px">
          {/* 색을 가진 행은 하나뿐이다. 담당자 미지정이 이 화면에서 지금
              잘못된 유일한 상태라, 나머지가 회색이라야 눈에 박힌다. */}
          <PropertyRow icon="◍" label="담당자" alert={!assigneeFilled}>
            {assigneeSlot}
          </PropertyRow>
          {/* 유형은 요청자도 바꾼다. 그래도 '지정'에 두는 이유는 셀렉트이기
              때문이다 — 머리 줄에 셀렉트를 넣으면 뱃지가 아니라 컨트롤이
              되어 그 줄이 무거워진다. 머리 줄은 값만 보여준다. */}
          {typeSlot && (
            <PropertyRow icon="◈" label="유형">
              {typeSlot}
            </PropertyRow>
          )}
          <PropertyRow icon="▤" label="배포예상일">
            {expectedSlot}
          </PropertyRow>
          {projectSlot && (
            <PropertyRow icon="▦" label="프로젝트">
              {projectSlot}
            </PropertyRow>
          )}
        </div>
      </div>

      {extras}

      <div className="border-t border-slate-200 pt-3">
        <button
          type="button"
          onClick={() => setOpenRequest((v) => !v)}
          aria-expanded={openRequest}
          className="flex w-full items-center gap-1.5 text-[10px] font-semibold tracking-widest text-slate-400 uppercase"
        >
          <span aria-hidden="true">{openRequest ? '▾' : '▸'}</span>요청 내용
        </button>
        {openRequest ? (
          <dl className="mt-2 flex flex-col gap-1 text-xs">
            {request.rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-slate-500">{label}</dt>
                <dd className="text-right text-slate-800">{value || '—'}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{request.summary}</p>
        )}
      </div>

      {/* 레드마인은 행이 아니라 섹션이다 — 자기 제목과 구분선을 갖고 있고,
          링크가 없을 때는 아예 사라진다. 한 줄에 밀어 넣으면 어긋난다. */}
      {redmineSlot}
    </aside>
  );
}
