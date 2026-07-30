import { ApiError } from './apiError';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// 프로젝트 시작일·목표일 입력값 정리.
//
// undefined 와 null 을 구분하는 것이 요점이다. PATCH 에서 undefined 는
// "이 칸은 건드리지 마라", null 은 "비워라"다. 둘을 뭉개면 이름만 고치려던
// 요청이 날짜를 지워버리고, 로드맵에서 프로젝트가 조용히 사라진다.
export function parseDateInput(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new ApiError(400, '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)');
  }
  return value;
}

// 목표일이 시작일보다 앞서면 막대 폭이 음수가 되고, CSS 는 조용히 0 으로
// 만들어 막대를 지운다. DB CHECK 로도 막지만 여기서 먼저 사람이 읽을 수 있는
// 메시지로 돌려준다.
export function assertDateOrder(startDate, targetDate) {
  if (!startDate || !targetDate) return;
  if (startDate > targetDate) {
    throw new ApiError(400, '목표일이 시작일보다 앞설 수 없습니다.');
  }
}
