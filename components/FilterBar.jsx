'use client';

import { useState } from 'react';
import { FilterSheet } from '@/components/FilterSheet';
import { FilterSelect } from '@/components/FilterSelect';
import { ActiveFilterChips } from '@/components/ActiveFilterChips';
import { activeFilterChips, buildFilterFields } from '@/lib/filterFields';
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
  const [sheetOpen, setSheetOpen] = useState(false);

  // 모바일 버튼에 붙는 숫자. 시트 안에 든 것이 몇 개인지 보여준다.
  const mobileActiveCount = countActiveFilters({ filters: value, mine, includeDone });

  // 칩은 모바일 전용이다. 시트 안 필터는 밖에서 안 보이므로 무엇이 걸렸는지
  // 드러낼 자리가 따로 필요하다. 데스크톱은 일곱 칸이 라벨과 값을 그대로
  // 보여주므로 칩이 같은 말을 두 번 하게 된다.
  const chips = activeFilterChips({ fields, filters: value, mine, includeDone });

  // 체크박스 둘은 fields 밖이라 따로 푼다.
  function removeChip(key) {
    if (key === 'mine') return onMineChange?.(false);
    if (key === 'includeDone') return onIncludeDoneChange?.(false);
    return onChange({ [key]: '' });
  }

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

      {/* 데스크톱: 흰 카드 안에 두 줄.
          윗줄은 검색과 옵션(종결 숨김·내 요청만·초기화), 아랫줄은 필터 격자다.
          예전처럼 한 줄에 전부 흘려 두면 '필터 초기화'가 나타났다 사라질 때마다
          셀렉트가 밀려서, 같은 필터가 매번 다른 자리에 있다.

          '필터 더보기'를 없앴다. 예전 주석에 "어느 필터가 실제로 쓰이는지 보이면
          기본 노출을 다시 정한다"고 적어 뒀는데, 그 답이 나왔다 — 값이 가장 잘
          갈리는 카테고리(9종)와 프로젝트(5종)가 접힌 쪽에 있었고, 그래서 아무도
          안 썼다. 접어 둔 필터는 없는 필터다.

          상태는 보드에서도 감추지 않는다. 보드는 상태가 컬럼 그 자체라 상태로
          거르면 컬럼 하나만 채워지는데, 그래도 컨트롤을 보여주는 쪽이 맞다 —
          목록에서 상태를 걸고 보드로 넘어왔을 때 컨트롤을 숨기면 필터는 URL 에
          남아 적용되는데 화면에는 근거가 없다. 보이지 않는 필터가 제일 나쁘다. */}
      <div className="hidden flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3 md:flex">
        <div className="flex items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="제목 검색"
            className="h-8 w-56 rounded-lg border border-slate-300 px-3 text-xs placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
          />
          {/* 옵션과 초기화는 오른쪽 끝에 붙인다. 필터 자체가 아니라 필터에
              거는 조건이라, 셀렉트 줄과 섞이면 같은 무게로 읽힌다. */}
          <div className="flex-1" />
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
          {/* 내가 올린 것만. 목록 화면의 요청자에게는 '내 요청' 칩이 같은 일을
              하므로 페이지가 이 핸들러를 안 넘긴다(app/requirements/page.js). */}
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

        {/* 일곱 개를 격자로 세운다. 라벨을 셀렉트 위에 따로 다는 것이 요점이다 —
            지금까지 라벨은 placeholder 였고, 값을 고르면 그 자리에 값이 들어오면서
            라벨이 사라졌다. '전시'라고만 적힌 칸을 보고 그게 카테고리인지 유형인지
            알 방법이 없었다. 접혀 있어서 못 쓴 것 절반, 이것 때문에 못 쓴 것
            절반이다. */}
        <div className="grid grid-cols-4 gap-2 lg:grid-cols-7">
          {fields.map((field) => (
            <div key={field.key} className="flex min-w-0 flex-col gap-1">
              <span className="px-0.5 text-[11px] font-medium text-slate-500">{field.label}</span>
              <FilterSelect
                label="전체"
                options={field.options}
                current={value[field.key]}
                onPick={(picked) => onChange({ [field.key]: picked })}
                className="h-8 w-full text-xs"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 걸린 필터를 이름과 값으로 드러낸다. 없으면 아무것도 안 그린다.
          모바일 전용이다 — 시트 안 필터는 밖에서 안 보이므로 여기가 유일한
          단서다. 데스크톱은 일곱 칸이 라벨과 값을 그대로 보여주므로 칩을 두면
          같은 말을 두 번 하면서 목록만 아래로 민다. */}
      <div className="md:hidden">
        <ActiveFilterChips chips={chips} onRemove={removeChip} />
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

