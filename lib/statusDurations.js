import { REQUIREMENT_STATUSES } from './statuses';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// 상태별 소요일. change_logs 에서 계산한다.
//
// 호출하는 쪽은 field_name='status' 로 걸러서 넘겨야 한다. change_type 으로
// 거르면 안 된다 — 상태 변경은 '상태변경'과 '중복병합' 두 change_type 을
// 쓴다(중복 병합은 change_logs.change_type='중복병합', field_name='status').
// change_type='상태변경'만 보면 병합된 건의 마지막 구간이 끊긴 것처럼 나온다.
//
// changeLogs: [{ old_value, new_value, created_at }]
// 반환: [{ status: string|null, days: number, ongoing: boolean }]
//   status===null 은 "구간 불명" — 이 시간에 무슨 상태였는지 믿을 수 없다는 뜻.
//   화면은 그렇게 정직하게 표시한다.
//
// 구간을 못 믿는 경우 둘:
//   1. 상태명이 REQUIREMENT_STATUSES 에 없다 — 이름 변경 마이그레이션(0007) 전의
//      옛 이름('정책정의' 등)이 이력에 그대로 남아 있다. rewrite 하지 않기로
//      했으므로 옛 이름은 계속 나온다.
//   2. 로그의 old_value 가 직전 구간에서 흘러온 값과 다르다 — 로그가 빠진
//      구간이다(과거 데이터, 수동 수정 등).
export function computeStatusDurations({ createdAt, currentStatus, changeLogs, nowIso }) {
  if (!createdAt || !currentStatus || !nowIso) return [];

  const logs = (changeLogs ?? [])
    .filter((l) => l?.new_value && l?.created_at)
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const raw = [];
  let cursorTime = createdAt;
  // 첫 로그가 있으면 그 로그의 old_value 가 최초 상태다. 없으면 지금까지
  // 쭉 currentStatus 였다는 뜻이다.
  let cursorStatus = logs.length > 0 ? logs[0].old_value : currentStatus;

  for (const log of logs) {
    const known = REQUIREMENT_STATUSES.includes(cursorStatus) && log.old_value === cursorStatus;
    raw.push({
      status: known ? cursorStatus : null,
      startMs: new Date(cursorTime).getTime(),
      endMs: new Date(log.created_at).getTime(),
    });
    cursorTime = log.created_at;
    cursorStatus = log.new_value;
  }

  // 마지막 구간은 "지금"까지다. 마지막 로그의 new_value 가 실제 현재 상태와
  // 다르면(데이터 이상 — 정상 흐름에서는 안 생긴다) 어느 쪽 이름도 믿지 않고
  // 구간 불명으로 둔다. 상태 자체는 requirements.status 가 진실이지만, 언제
  // 그 상태가 됐는지는 이력이 설명하지 못하는 것이기 때문이다.
  const finalKnown = REQUIREMENT_STATUSES.includes(cursorStatus) && cursorStatus === currentStatus;
  raw.push({
    status: finalKnown ? currentStatus : null,
    startMs: new Date(cursorTime).getTime(),
    endMs: new Date(nowIso).getTime(),
    ongoing: true,
  });

  // 두 단계: 정확히 0ms 인 구간은 버리고(로그 두 개가 같은 순간에 찍힌
  // 경우), 연속된 '구간 불명'은 하나로 합친다. 나눠서 여러 줄로 보여줘도
  // 사용자가 얻는 정보가 없고, 오히려 문제가 여러 번 있었던 것처럼 읽힌다.
  const merged = [];
  for (const seg of raw) {
    const ms = Math.max(0, seg.endMs - seg.startMs);
    if (ms === 0 && !seg.ongoing) continue;
    const prev = merged[merged.length - 1];
    if (seg.status === null && prev?.status === null && !prev.ongoing) {
      prev.ms += ms;
      continue;
    }
    merged.push({ status: seg.status, ms, ongoing: Boolean(seg.ongoing) });
  }

  return merged.map(({ status, ms, ongoing }) => ({
    status,
    days: Math.round(ms / MS_PER_DAY),
    ongoing,
  }));
}
