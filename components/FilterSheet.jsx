'use client';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FilterSelect } from '@/components/FilterSelect';
import { buildFilterFields } from '@/lib/filterFields';

// 모바일 필터 시트.
//
// 새 오버레이 메커니즘을 만들지 않는다 — 기존 Dialog 를 그대로 쓴다. 모바일
// 에서는 sm:max-w-* 가 안 걸려 이미 화면을 거의 채우므로 시트처럼 동작한다.
//
// 선택지는 buildFilterFields 에서 온다. 여기에 셀렉트를 복제해 두면 필터를
// 하나 늘릴 때 필터바와 이곳 중 한쪽만 고치는 사고가 난다.
//
// 트리거 높이가 h-11(44px)인 것이 이 화면의 요점이다. 데스크톱 필터바의 h-8
// 을 그대로 가져오면 손가락으로 못 누른다.
export function FilterSheet({
  open,
  onOpenChange,
  teamMembers,
  categories,
  projects,
  value,
  onChange,
  onReset,
  includeDone,
  onIncludeDoneChange,
  showIncludeDone = true,
  mine = false,
  onMineChange,
}) {
  const fields = buildFilterFields({ teamMembers, categories, projects });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>필터</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* 셀렉트 자체가 '전체'로 되돌릴 수 있으므로 필드마다 따로 '지우기'
              버튼을 두지 않는다. 시트 밖에 칩도 있어서, 버튼까지 두면 한 값을
              푸는 길이 셋이 된다. */}
          {fields.map((field) => (
            <div key={field.key} className="flex flex-col gap-1">
              <Label htmlFor={`filter-sheet-${field.key}`}>{field.label}</Label>
              <FilterSelect
                label="전체"
                options={field.options}
                current={value[field.key]}
                onPick={(picked) => onChange({ [field.key]: picked })}
                className="h-11 w-full text-sm"
              />
            </div>
          ))}

          {/* 라벨이 "종결 숨김"이므로 체크됨 = 숨김 = includeDone === false 다.
              데스크톱 필터바와 같은 규칙이다. */}
          {showIncludeDone && (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={!includeDone}
                onChange={(e) => onIncludeDoneChange(!e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              종결 숨김 (완료·반려·취소·중복)
            </label>
          )}
          {onMineChange && (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={mine}
                onChange={(e) => onMineChange(e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              내가 등록한 것만
            </label>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 border-t border-slate-100 pt-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            onClick={() => {
              onReset();
              onOpenChange(false);
            }}
          >
            초기화
          </Button>
          <Button
            type="button"
            className="h-11 flex-1 bg-indigo-600 hover:bg-indigo-700"
            onClick={() => onOpenChange(false)}
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
