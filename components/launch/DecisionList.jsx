'use client';

import { useState } from 'react';
import { DecisionDialog } from '@/components/launch/DecisionDialog';

// 결정 대기 화면.
//
// 476건 중 회의에서 실제로 다투는 것은 이 목록 만큼이고 나머지는 그 결과다.
// impact(미결 시 영향)가 왜 지금 답해야 하는지를 말한다 — 이미 사람이 써
// 두었다. when_text 는 '9월 중' 그대로 보여준다. 날짜로 바꾸면 없는
// 정확도가 생기고, 그 날짜가 지나면 화면이 거짓말로 붉어진다.
//
// props: launchId, decisions, onSaved(decision) — 기록·추가 둘 다 이 하나로
//        올린다. 페이지가 id 로 목록에서 갈아 끼우거나(이미 있음) 붙인다
//        (없으면).
export function DecisionList({ launchId, decisions = [], onSaved }) {
  // { mode: 'record', decision } 또는 { mode: 'create' } 또는 null.
  const [dialog, setDialog] = useState(null);

  const pending = decisions.filter((d) => d.status === '대기');
  const rest = decisions.filter((d) => d.status !== '대기');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-slate-500">
          회의에서 실제로 다투는 것은 이 목록입니다. 나머지 항목은 여기의 결과입니다.
        </p>
        <button
          type="button"
          onClick={() => setDialog({ mode: 'create' })}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          ＋ 결정
        </button>
      </div>

      {decisions.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
          아직 결정 항목이 없습니다.
        </p>
      )}

      {pending.length > 0 && (
        <ul className="flex flex-col gap-2">
          {pending.map((d) => (
            <DecisionRow key={d.id} decision={d} onRecord={() => setDialog({ mode: 'record', decision: d })} />
          ))}
        </ul>
      )}

      {/* 결정된 것은 흐리게 — 매번 다시 봐야 할 것이 아니라, 왜 그렇게
          정했는지 찾을 때만 펼치면 되는 기록이다. */}
      {rest.length > 0 && (
        <ul className="flex flex-col gap-2 opacity-60">
          {rest.map((d) => (
            <DecisionRow key={d.id} decision={d} />
          ))}
        </ul>
      )}

      {/* 닫히면 언마운트시킨다. 계속 그리면 useState 초기화 함수가 다시 안
          돌아서 지난 결정의 값이 남는다. */}
      {dialog && (
        <DecisionDialog
          open
          mode={dialog.mode ?? 'record'}
          launchId={launchId}
          decision={dialog.mode === 'record' ? dialog.decision : null}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

function DecisionRow({ decision: d, onRecord }) {
  const decided = d.status === '결정';

  return (
    <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-800">
            {d.when_text && (
              <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                {d.when_text}
              </span>
            )}
            <b className="font-medium">{d.title}</b>
          </p>

          {/* impact 는 붉은 계열로 — 왜 급한지가 이 한 줄이다. */}
          {d.impact && !decided && (
            <p className="mt-1 text-[13px] text-rose-700">미결 시 · {d.impact}</p>
          )}

          {/* 결정 주체와 '기다리는 항목' 을 한 줄에 — waitingCount 가 있으면
              눈에 띄게, 없으면 조용히 넘어간다. */}
          {!decided && (d.owner_text || d.waitingCount > 0) && (
            <p className="mt-0.5 text-[13px] text-slate-500">
              {d.owner_text}
              {d.owner_text && d.waitingCount > 0 && ' · '}
              {d.waitingCount > 0 && (
                <span className="font-medium text-amber-700">
                  막힌 항목 {d.waitingCount}건이 이것을 기다립니다
                </span>
              )}
            </p>
          )}

          {decided && (
            <div className="mt-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
              {d.decided_note}
            </div>
          )}

          {!decided && d.status !== '대기' && (
            <p className="mt-0.5 text-[13px] text-slate-400">{d.status}</p>
          )}
        </div>

        {d.status === '대기' && (
          <button
            type="button"
            onClick={onRecord}
            className="shrink-0 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
          >
            결정 기록
          </button>
        )}
      </div>
    </li>
  );
}
