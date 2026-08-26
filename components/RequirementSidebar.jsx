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
//   assigneeSlot, expectedSlot, redmineSlot, projectSlot — 각 행의 컨트롤
//   statusText — 상태는 여기서 바꾸지 않는다(머리 줄의 버튼이 한다)
//   request — { summary, rows: [[label, value], ...] }
export function RequirementSidebar({
  assigneeFilled,
  assigneeSlot,
  statusText,
  expectedSlot,
  redmineSlot,
  projectSlot,
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
          <PropertyRow icon="◌" label="상태" value={statusText} />
          <PropertyRow icon="▤" label="배포예상일">
            {expectedSlot}
          </PropertyRow>
          {redmineSlot && (
            <PropertyRow icon="↗" label="레드마인">
              {redmineSlot}
            </PropertyRow>
          )}
          {projectSlot && (
            <PropertyRow icon="▦" label="프로젝트">
              {projectSlot}
            </PropertyRow>
          )}
        </div>
      </div>

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
    </aside>
  );
}
