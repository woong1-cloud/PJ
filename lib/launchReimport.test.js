import { describe, expect, it } from 'vitest';
import { IMPORT_EXCLUDED_REASON, planReimport } from './launchReimport';

const inc = (code, over = {}) => ({
  code, title: '제목', workstream: 'D01', day_offset: -100,
  not_applicable: false, excluded_reason: null, ...over,
});
const have = (code, over = {}) => ({
  id: 'u-' + code, code, status: '할 것', source: 'import',
  excluded_reason: null, ...over,
});

describe('planReimport', () => {
  it('새 코드는 만든다', () => {
    const p = planReimport({ incoming: [inc('01-01')], existing: [] });
    expect(p.create.map((c) => c.code)).toEqual(['01-01']);
    expect(p.create[0].status).toBe('할 것');
  });

  it('양식이 해당없음이면 해당없음으로 만든다', () => {
    const p = planReimport({
      incoming: [inc('03-03', { not_applicable: true, excluded_reason: '[중복] 01-21에서 관리' })],
      existing: [],
    });
    expect(p.create[0].status).toBe('해당없음');
    expect(p.create[0].excluded_reason).toBe('[중복] 01-21에서 관리');
  });

  it('있는 코드는 계획 열만 갱신한다', () => {
    const p = planReimport({
      incoming: [inc('01-01', { title: '고친 제목', day_offset: -75 })],
      existing: [have('01-01', { status: '하는 중' })],
    });
    expect(p.update).toHaveLength(1);
    expect(p.update[0].patch.title).toBe('고친 제목');
    expect(p.update[0].patch.day_offset).toBe(-75);
  });

  it('진행은 안 건드린다 — 이걸 지우면 아무도 두 번 안 올린다', () => {
    const p = planReimport({
      incoming: [inc('01-01')],
      existing: [have('01-01', { status: '막힘' })],
    });
    const keys = Object.keys(p.update[0].patch);
    for (const k of ['status', 'assignee', 'blocked_reason', 'done_at', 'blocked_decision_id']) {
      expect(keys, k).not.toContain(k);
    }
  });

  it('시트에서 사라지면 해당없음으로 바꾼다', () => {
    const p = planReimport({ incoming: [], existing: [have('13-27')] });
    expect(p.exclude).toHaveLength(1);
    expect(p.exclude[0].excluded_reason).toBe(IMPORT_EXCLUDED_REASON);
    expect(p.exclude[0].previous_status).toBe('할 것');
  });

  it('사라졌는데 완료면 그대로 둔다 — 이미 한 일이다', () => {
    const p = planReimport({ incoming: [], existing: [have('01-01', { status: '완료' })] });
    expect(p.exclude).toEqual([]);
    expect(p.untouched.map((u) => u.code)).toEqual(['01-01']);
  });

  it('사라졌는데 이미 해당없음이면 그대로 둔다', () => {
    const p = planReimport({
      incoming: [],
      existing: [have('09-04', { status: '해당없음', excluded_reason: '우리는 안 함' })],
    });
    expect(p.exclude).toEqual([]);
  });

  it('사라졌는데 손으로 넣은 항목이면 그대로 둔다', () => {
    // 시트 밖에서 난 일이라 시트에 없는 게 당연하다.
    const p = planReimport({ incoming: [], existing: [have('19-91', { source: 'manual' })] });
    expect(p.exclude).toEqual([]);
    expect(p.untouched[0].why).toBe('manual');
  });

  it('가져오기가 뺐던 것이 다시 나타나면 되살린다', () => {
    const p = planReimport({
      incoming: [inc('13-27')],
      existing: [have('13-27', { status: '해당없음', excluded_reason: IMPORT_EXCLUDED_REASON })],
    });
    expect(p.restore.map((r) => r.code)).toEqual(['13-27']);
  });

  it('직전 상태가 사유 뒤에 붙어 있어도 되살린다', () => {
    // 서버가 저장할 때 '양식에서 빠짐 (직전 상태: 하는 중)' 으로 쓴다.
    // 완전 일치로 검사하면 되살리기가 조용히 안 된다.
    const p = planReimport({
      incoming: [inc('16-11')],
      existing: [have('16-11', {
        status: '해당없음',
        excluded_reason: `${IMPORT_EXCLUDED_REASON} (직전 상태: 하는 중)`,
      })],
    });
    expect(p.restore.map((r) => r.code)).toEqual(['16-11']);
    expect(p.restore[0].status).toBe('하는 중');
  });

  it('직전 상태가 안 적혀 있으면 할 것으로 되살린다', () => {
    const p = planReimport({
      incoming: [inc('13-27')],
      existing: [have('13-27', { status: '해당없음', excluded_reason: IMPORT_EXCLUDED_REASON })],
    });
    expect(p.restore[0].status).toBe('할 것');
  });

  it('사람이 사유를 적어 뺀 것은 다시 나타나도 안 되살린다', () => {
    // 사람의 판단이 파일보다 세다. 안 그러면 "우리는 안 함"으로 뺀 항목이
    // 다음 가져오기마다 되살아난다.
    const p = planReimport({
      incoming: [inc('09-04')],
      existing: [have('09-04', { status: '해당없음', excluded_reason: '우리는 인하우스로 함' })],
    });
    expect(p.restore).toEqual([]);
    expect(p.update).toHaveLength(1); // 계획 열은 그래도 갱신한다
  });

  it('빈 입력에서 죽지 않는다', () => {
    // 반환 모양을 통째로 못 박는다. 칸이 하나 늘면 이 줄이 먼저 깨져서,
    // 부르는 쪽(가져오기 라우트·미리보기)이 새 칸을 놓치는 일을 막는다.
    //
    // markNa·busy 는 나중에 더했다 — 양식이 *이미 있는* 항목을 해당없음으로
    // 바꿀 때를 처음에 빠뜨렸고, 그러면 브랜드가 표시한 것이 무시된다.
    const p = planReimport({});
    expect(p).toEqual({
      create: [],
      update: [],
      exclude: [],
      restore: [],
      markNa: [],
      busy: [],
      untouched: [],
    });
  });
});

describe('양식이 있는 항목을 해당없음으로 바꿀 때', () => {
  // 브랜드가 양식을 채우는 흐름의 핵심이다.
  //
  // 1차 업로드로 451건이 들어간 뒤, 브랜드가 "앱 18건은 안 함"을 표시해
  // 다시 올린다. 그 18건은 이미 있는 항목이라 update 로 가는데, 계획 열만
  // 덮으면 해당없음이 통째로 무시된다 — 양식을 만든 의미가 사라진다.
  //
  // '해당없음'은 진행 상태가 아니라 범위다. "이 브랜드에는 안 하는 일"이고,
  // 그 판단은 엑셀이 원본이다.
  const na = (code) =>
    inc(code, { not_applicable: true, excluded_reason: '앱은 2차로 미루기로 함' });

  it('아직 손 안 댄 항목이면 해당없음으로 바꾼다', () => {
    const p = planReimport({ incoming: [na('16-01')], existing: [have('16-01')] });
    expect(p.markNa.map((m) => m.code)).toEqual(['16-01']);
    expect(p.markNa[0].excluded_reason).toBe('앱은 2차로 미루기로 함');
    // 계획 열 갱신은 그대로 함께 간다.
    expect(p.update).toHaveLength(1);
  });

  it('하는 중이면 안 바꾼다 — 사람이 이미 붙어 있다', () => {
    // 양식이 늦게 반영된 것일 수 있다. 진행 중인 일을 파일이 지우면 안 된다.
    const p = planReimport({
      incoming: [na('16-01')],
      existing: [have('16-01', { status: '하는 중' })],
    });
    expect(p.markNa).toEqual([]);
    expect(p.busy.map((b) => b.code)).toEqual(['16-01']);
    expect(p.busy[0].status).toBe('하는 중');
  });

  it('막힘도 안 바꾼다', () => {
    const p = planReimport({
      incoming: [na('16-01')],
      existing: [have('16-01', { status: '막힘' })],
    });
    expect(p.markNa).toEqual([]);
    expect(p.busy).toHaveLength(1);
  });

  it('완료면 안 바꾼다 — 이미 한 일이다', () => {
    const p = planReimport({
      incoming: [na('16-01')],
      existing: [have('16-01', { status: '완료' })],
    });
    expect(p.markNa).toEqual([]);
    expect(p.busy).toHaveLength(1);
  });

  it('이미 해당없음이면 아무 일도 안 한다', () => {
    const p = planReimport({
      incoming: [na('16-01')],
      existing: [have('16-01', { status: '해당없음', excluded_reason: '먼저 쓴 사유' })],
    });
    expect(p.markNa).toEqual([]);
    expect(p.busy).toEqual([]);
    // 그리고 되살리지도 않는다. 양식이 여전히 해당없음이라고 말하고 있다.
    expect(p.restore).toEqual([]);
  });

  it('양식이 다시 해당으로 바꾸면 가져오기가 뺐던 것만 되살린다', () => {
    const p = planReimport({
      incoming: [inc('16-01')],
      existing: [have('16-01', { status: '해당없음', excluded_reason: IMPORT_EXCLUDED_REASON })],
    });
    expect(p.restore).toHaveLength(1);
    expect(p.markNa).toEqual([]);
  });
});
