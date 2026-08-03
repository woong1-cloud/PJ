'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FilterSheet } from '@/components/FilterSheet';
import { buildFilterFields, PRIMARY_FILTER_KEYS } from '@/lib/filterFields';
import { countActiveFilters, hasActiveFilters } from '@/lib/requirementFilters';

// 목록과 보드가 함께 쓴다. 필터 값 자체는 URL 이 들고 있고(useRequirementFilters)
// 이 컴포넌트는 그리기만 한다.
//
// 모바일과 데스크톱이 같은 컴포넌트 안에서 갈린다. 모바일은 검색창 + '필터 N'
// 버튼 한 줄이고 나머지는 시트 안이다. 375px 에서 셀렉트를 늘어놓으면 필터가
// 화면 위 120px 를 먹는데, 요구사항은 아직 아홉 건이다.
//
// props: teamMembers[], categories[], projects[],
//        value{status,type,assignee,category,channel,priority,project},
//        onChange(patch), query, onQueryChange, onReset,
//        includeDone, onIncludeDoneChange, showIncludeDone, mine, onMineChange
export function FilterBar({
  teamMembers,
  categories,
  projects,
  value,
  onChange,
  query,
  onQueryChange,
  onReset,
  includeDone,
  onIncludeDoneChange,
  // 보드에서는 끈다. 이유는 아래 체크박스 주석 참조.
  showIncludeDone = true,
  mine = false,
  onMineChange,
}) {
  const fields = buildFilterFields({ teamMembers, categories, projects });
  const primary = fields.filter((f) => PRIMARY_FILTER_KEYS.includes(f.key));
  const secondary = fields.filter((f) => !PRIMARY_FILTER_KEYS.includes(f.key));

  // 접힌 쪽에 값이 걸린 채로 닫혀 있으면 사용자는 목록이 왜 이것뿐인지 모른다.
  // 그래서 값이 하나라도 있으면 처음부터 펼친 상태로 연다.
  const hiddenActiveCount = secondary.filter((f) => value[f.key]).length;
  const [expanded, setExpanded] = useState(hiddenActiveCount > 0);
  const [sheetOpen, setSheetOpen] = useState(false);

  // 모바일 버튼에 붙는 숫자. 시트 안에 든 것이 몇 개인지 보여준다.
  const mobileActiveCount = countActiveFilters({ filters: value, mine, includeDone });

  return (
    <>
      {/* 모바일: 검색 + 필터 버튼 한 줄.
          검색창 글자를 text-base(16px)로 두는 이유는 iOS Safari 때문이다.
          16px 미만인 입력에 포커스가 가면 화면을 자동으로 확대해 버리고,
          그러면 사용자가 손으로 다시 축소해야 한다. */}
      <div className="flex items-center gap-2 md:hidden">
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="제목 검색"
          className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-base placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={`h-11 shrink-0 rounded-lg border px-4 text-sm ${
            mobileActiveCount > 0
              ? 'border-indigo-300 bg-indigo-50 font-medium text-indigo-700'
              : 'border-slate-300 text-slate-600'
          }`}
        >
          필터{mobileActiveCount > 0 ? ` ${mobileActiveCount}` : ''}
        </button>
      </div>

      <div className="hidden flex-wrap items-center gap-2 md:flex">
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="제목 검색"
          className="h-8 w-48 rounded-lg border border-slate-300 px-3 text-xs placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
        />
        {/* 상태는 보드에서도 감추지 않는다. 보드는 상태가 컬럼 그 자체라
            상태로 거르면 컬럼 하나만 채워지는데, 그래도 컨트롤을 보여주는
            쪽이 맞다 — 목록에서 상태를 걸고 보드로 넘어왔을 때 컨트롤을
            숨기면 필터는 URL 에 남아 적용되는데 화면에는 근거가 없다.
            보이지 않는 필터가 제일 나쁘다. */}
        {primary.map((field) => (
          <FilterSelect
            key={field.key}
            placeholder={field.label}
            options={field.options}
            current={value[field.key]}
            onPick={(picked) => onChange({ [field.key]: picked })}
          />
        ))}
        {/* 여기부터는 접는다.
            필터가 일곱 개인데 요구사항은 아직 아홉 건이다. 이 정도 규모에서는
            아무도 필터를 안 쓰고, 늘 펼쳐 두면 검색창과 상태만 찾는 사람에게
            나머지가 전부 소음이 된다.
            어느 필터가 실제로 쓰이는지는 URL 파라미터를 보면 나온다 — 그때
            기본 노출을 다시 정한다. 지금 정하면 그건 추측이다. */}
        {expanded &&
          secondary.map((field) => (
            <FilterSelect
              key={field.key}
              placeholder={field.label}
              options={field.options}
              current={value[field.key]}
              onPick={(picked) => onChange({ [field.key]: picked })}
            />
          ))}

        {/* 접힌 쪽에 값이 걸려 있으면 개수를 보여준다. 안 그러면 결과가 좁아진
            이유가 화면 어디에도 없다 — 보이지 않는 필터가 제일 나쁘다. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-slate-500 underline hover:text-slate-700"
        >
          {expanded
            ? '필터 접기'
            : `필터 더보기${hiddenActiveCount > 0 ? ` (${hiddenActiveCount})` : ''}`}
        </button>
        {/* 라벨이 "종결 숨김"이므로 체크됨 = 숨김 = includeDone === false 다.
            숨기는 대상이 완료만이 아니라 반려·취소·중복까지이므로 라벨도 그렇게
            적는다 — "완료 숨김"이라고 써 두면 반려된 건이 사라진 이유를 알 수 없다.
            쿼리 파라미터 이름(includeDone)은 목록·보드·병합 세 곳이 쓰고 있어 둔다.

            보드에서는 이 체크박스를 아예 감춘다(showIncludeDone={false}).
            KanbanBoard 는 BOARD_STATUSES 컬럼만 그리므로 반려·취소·중복은 값과
            무관하게 화면에 없고, '완료' 컬럼은 항상 채워져야 한다. 눌러도 아무
            변화가 없는 토글은 없는 것만 못하다. */}
        {showIncludeDone && (
          <label
            className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500"
            title="완료·반려·취소·중복된 요구사항을 목록에서 숨깁니다."
          >
            <input
              type="checkbox"
              checked={!includeDone}
              onChange={(e) => onIncludeDoneChange(!e.target.checked)}
              className="h-3.5 w-3.5 accent-indigo-600"
            />
            종결 숨김
          </label>
        )}
        {/* 내가 올린 것만. 4차 요청자가 가장 자주 찾는 화면인데 지금까지
            방법이 없었다(담당자 필터만 있었다). 요청자 셀렉트를 두는 대신
            토글로 둔 이유는 lib/requirementFilters.js 주석 참조. */}
        {onMineChange && (
          <label
            className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500"
            title="내가 등록한 요구사항만 봅니다."
          >
            <input
              type="checkbox"
              checked={mine}
              onChange={(e) => onMineChange(e.target.checked)}
              className="h-3.5 w-3.5 accent-indigo-600"
            />
            내 요청만
          </label>
        )}
        {hasActiveFilters({ filters: value, query, mine }) && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-slate-500 underline hover:text-slate-700"
          >
            필터 초기화
          </button>
        )}
      </div>

      <FilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        teamMembers={teamMembers}
        categories={categories}
        projects={projects}
        value={value}
        onChange={onChange}
        onReset={onReset}
        includeDone={includeDone}
        onIncludeDoneChange={onIncludeDoneChange}
        showIncludeDone={showIncludeDone}
        mine={mine}
        onMineChange={onMineChange}
      />
    </>
  );
}

function FilterSelect({ placeholder, options, current, onPick }) {
  return (
    <Select items={options} value={current || null} onValueChange={onPick}>
      <SelectTrigger className="h-8 w-32 text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
