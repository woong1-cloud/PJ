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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
          {fields.map((field) => (
            <div key={field.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <Label htmlFor={`filter-sheet-${field.key}`}>{field.label}</Label>
                {/* 셀렉트만으로는 고른 값을 되돌릴 수 없다(빈 항목이 없다).
                    데스크톱에는 '필터 초기화'가 있지만 그건 전부를 지운다 —
                    하나만 풀고 싶은 경우가 훨씬 흔하다. */}
                {value[field.key] && (
                  <button
                    type="button"
                    onClick={() => onChange({ [field.key]: '' })}
                    className="text-xs text-slate-500 underline hover:text-slate-700"
                  >
                    지우기
                  </button>
                )}
              </div>
              <Select
                items={field.options}
                value={value[field.key] || null}
                onValueChange={(picked) => onChange({ [field.key]: picked })}
              >
                <SelectTrigger id={`filter-sheet-${field.key}`} className="h-11 w-full text-sm">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
