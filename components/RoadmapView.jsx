'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { buildRoadmap } from '@/lib/roadmap';
import { toLocalDateString } from '@/lib/overdue';

// 로드맵 — 프로젝트를 시간축에 눕혀 놓은 화면.
//
// 자리 계산은 전부 lib/roadmap.js 에 있다. 이 파일은 계산 결과를 %로 받아
// 그리기만 한다. 계산과 그리기를 섞으면 "막대가 한 달 밀렸다"를 테스트로
// 잡을 수 없게 되고, 로드맵에서 그 오차는 눈으로 안 보인다.
//
// props: projects([{..., requirements:[]}] — withRequirements=true 로 받은 것)
export function RoadmapView({ projects }) {
  const todayIso = useMemo(() => toLocalDateString(new Date()), []);
  const roadmap = useMemo(() => {
    const list = projects ?? [];
    return buildRoadmap({
      projects: list,
      requirements: list.flatMap((p) => p.requirements ?? []),
      todayIso,
    });
  }, [projects, todayIso]);

  const { ticks, rows, undated, todayPct } = roadmap;

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        {/* 최소 폭을 주는 이유: 3개월이 좁은 화면에 눌리면 하루가 1px 아래로
            내려가 막대들이 서로 붙어 버린다. 좁으면 가로로 스크롤하는 게 낫다. */}
        <div className="min-w-[640px]">
          <div className="flex">
            <div className="w-40 shrink-0" />
            <div className="relative flex-1">
              <div className="flex border-b border-slate-200">
                {ticks.map((t) => (
                  <div
                    key={t.key}
                    style={{ width: `${t.widthPct}%` }}
                    className="border-l border-slate-100 px-1 pb-1 text-[11px] text-slate-400 first:border-l-0"
                  >
                    {t.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">기간이 정해진 프로젝트가 없습니다.</p>
          ) : (
            <div className="relative">
              {/* 오늘 선. 막대 뒤가 아니라 위에 그린다 — 막대에 가려지면
                  진행 중인 프로젝트에서만 안 보이게 되어 제일 필요할 때 없다. */}
              {todayPct !== null && (
                <div
                  className="pointer-events-none absolute bottom-0 top-0 z-10 border-l border-dashed border-rose-400"
                  style={{ left: `calc(10rem + (100% - 10rem) * ${todayPct / 100})` }}
                  aria-hidden
                />
              )}
              {rows.map((row) => (
                <RoadmapRow key={row.id} row={row} ticks={ticks} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Legend />

      {undated.length > 0 && (
        // 날짜 없는 프로젝트를 조용히 빼면 "내 프로젝트가 왜 로드맵에 없지"가
        // 되고, 그 답이 화면에 없으면 아무도 날짜를 채우지 않는다.
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-600">
            기간 미정 {undated.length}건 — 시작일/목표일을 넣으면 위 로드맵에 표시됩니다
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {undated.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="text-sm text-indigo-600 hover:underline"
              >
                {p.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RoadmapRow({ row, ticks }) {
  const g = row.geometry;
  return (
    <div className="flex items-center border-b border-slate-100 py-2">
      <div className="w-40 shrink-0 pr-2">
        <Link
          href={`/projects/${row.id}`}
          className="line-clamp-2 text-sm text-indigo-600 hover:underline"
          title={row.name}
        >
          {row.name}
        </Link>
      </div>
      <div className="relative h-7 flex-1">
        {/* 월 구분선을 행마다 다시 그린다. 축에만 있으면 막대가 어느 달에
            걸쳐 있는지 눈으로 못 따라간다. */}
        <div className="absolute inset-0 flex">
          {ticks.map((t) => (
            <div
              key={t.key}
              style={{ width: `${t.widthPct}%` }}
              className="border-l border-slate-100 first:border-l-0"
            />
          ))}
        </div>

        {g && row.kind === 'range' && (
          <div
            className={`absolute top-1.5 h-4 rounded bg-indigo-100 ${
              g.clippedStart ? '' : 'rounded-l'
            } ${g.clippedEnd ? '' : 'rounded-r'}`}
            style={{ left: `${g.leftPct}%`, width: `${g.widthPct}%` }}
            title={`${row.start_date} ~ ${row.target_date}`}
          >
            <span className="absolute inset-y-0 left-0 w-0.5 bg-indigo-400" />
            <span className="absolute inset-y-0 right-0 w-0.5 bg-indigo-400" />
          </div>
        )}

        {g && row.kind === 'milestone' && (
          // 한쪽 날짜만 정해진 프로젝트. 막대로 그리면 아무도 정하지 않은
          // 나머지 한쪽을 시스템이 정해 준 것처럼 보인다.
          <span
            className="absolute top-2 h-3 w-3 -translate-x-1/2 rotate-45 border border-indigo-400 bg-white"
            style={{ left: `${g.leftPct}%` }}
            title={`${row.start_date ?? row.target_date} (한쪽만 정해짐)`}
          />
        )}

        {row.markers.map((m) => (
          <Link
            key={m.id}
            href={`/requirements/${m.id}`}
            className={`absolute top-3 h-2 w-2 -translate-x-1/2 rounded-full ring-1 ring-white ${
              m.overdue ? 'bg-rose-500' : 'bg-indigo-500'
            }`}
            style={{ left: `${m.pct}%` }}
            title={`${m.date} · ${m.status} · ${m.title}${m.overdue ? ' (지연)' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-6 rounded bg-indigo-100" />
        프로젝트 기간
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-2.5 rotate-45 border border-indigo-400 bg-white" />
        한쪽 날짜만 정해짐
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-indigo-500" />
        요구사항 배포예상일
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-rose-500" />
        지연
      </span>
      <span className="flex items-center gap-1">
        <span className="h-3 border-l border-dashed border-rose-400" />
        오늘
      </span>
    </div>
  );
}
