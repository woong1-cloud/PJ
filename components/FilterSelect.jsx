'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CLEAR_FILTER_VALUE } from '@/lib/filterFields';

// 필터 셀렉트 하나. 필터바(데스크톱)와 필터 시트(모바일)가 같이 쓴다.
//
// 목록 맨 위에 '전체' 가 있는 것이 이 컴포넌트의 요점이다. 예전에는 한 번 고른
// 값을 되돌릴 방법이 '필터 초기화'(전부 지움)뿐이었다. 담당자 하나를 잘못
// 골랐는데 상태·채널까지 같이 날아가는 것은 되돌리기가 아니다.
//
// 셀렉트를 연 사람이 거기서 되돌릴 수 있기를 기대한다 — 가장 먼저 찾는 자리다.
export function FilterSelect({ label, options, current, onPick, className = 'h-8 w-32 text-xs' }) {
  const items = [{ value: CLEAR_FILTER_VALUE, label: '전체' }, ...options];
  return (
    <Select
      items={items}
      value={current || null}
      onValueChange={(picked) => onPick(picked === CLEAR_FILTER_VALUE ? '' : picked)}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.value === CLEAR_FILTER_VALUE ? (
              // 값이 아니라 해제라는 것을 색으로 구분한다. 목록에 섞여 있으면
              // '전체'라는 이름의 채널이 있는 줄 안다.
              <span className="text-slate-400">전체</span>
            ) : (
              o.label
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
