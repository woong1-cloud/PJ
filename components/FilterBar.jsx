'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CHANNELS } from '@/lib/channels';
import { hasActiveFilters } from '@/lib/requirementFilters';

const PRIORITIES = ['상', '중', '하'];

// 목록과 보드가 함께 쓴다. 필터 값 자체는 URL 이 들고 있고(useRequirementFilters)
// 이 컴포넌트는 그리기만 한다.
//
// props: teamMembers[], categories[], projects[],
//        value{assignee,category,channel,priority,project},
//        onChange(patch), query, onQueryChange, onReset,
//        includeDone, onIncludeDoneChange, showIncludeDone
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
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="제목 검색"
        className="h-8 w-48 rounded-lg border border-slate-300 px-3 text-xs placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
      />
      <FilterSelect
        placeholder="담당자"
        options={teamMembers.map((m) => ({ value: m.id, label: m.name }))}
        current={value.assignee}
        onPick={(v) => onChange({ assignee: v })}
      />
      <FilterSelect
        placeholder="카테고리"
        options={categories.map((c) => ({ value: c.id, label: c.category_name }))}
        current={value.category}
        onPick={(v) => onChange({ category: v })}
      />
      <FilterSelect
        placeholder="채널"
        options={CHANNELS.map((c) => ({ value: c, label: c }))}
        current={value.channel}
        onPick={(v) => onChange({ channel: v })}
      />
      <FilterSelect
        placeholder="우선순위"
        options={PRIORITIES.map((p) => ({ value: p, label: p }))}
        current={value.priority}
        onPick={(v) => onChange({ priority: v })}
      />
      <FilterSelect
        placeholder="프로젝트"
        options={projects.map((p) => ({ value: p.id, label: p.name }))}
        current={value.project}
        onPick={(v) => onChange({ project: v })}
      />
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
      {hasActiveFilters({ filters: value, query }) && (
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-slate-500 underline hover:text-slate-700"
        >
          필터 초기화
        </button>
      )}
    </div>
  );
}

function FilterSelect({ placeholder, options, current, onPick }) {
  return (
    <Select
      items={options}
      value={current || null}
      onValueChange={onPick}
    >
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
