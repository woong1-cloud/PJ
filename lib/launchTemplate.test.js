import { describe, expect, it } from 'vitest';
import { firstLookRows, restRows, templateRow, optionsFrom } from './launchTemplate';
import { COL } from './launchImport';

const OPEN = '2027-01-05';

// 최소 항목 하나. 필요한 필드만 채우고 나머지는 테스트마다 덮어쓴다.
function task(over = {}) {
  return {
    id: '1',
    code: '01-01',
    workstream: '01_신규법인',
    category: '법인/자격',
    title: '사업자등록',
    channel: '공통',
    decision_org: '브랜드',
    owner_org: '지원조직',
    owner_role: '법무',
    support_role: '재무',
    depends_on: [],
    day_offset: -90,
    deliverable: '사업자등록증',
    note: null,
    is_critical: true,
    status: '할 것',
    excluded_reason: null,
    ...over,
  };
}

describe('firstLookRows / restRows', () => {
  it('★ 이면서 결정권이 브랜드인 것만 먼저 볼 것으로 고른다', () => {
    const critical = task({ code: '01-01', is_critical: true, decision_org: '브랜드' });
    const notCritical = task({ code: '01-02', is_critical: false, decision_org: '브랜드' });
    const notBrand = task({ code: '01-03', is_critical: true, decision_org: '온라인BU' });
    const tasks = [critical, notCritical, notBrand];

    expect(firstLookRows(tasks)).toEqual([critical]);
    expect(restRows(tasks)).toEqual([notCritical, notBrand]);
  });

  it('둘을 합치면 전체와 같다 — 겹치거나 빠지는 줄이 없다', () => {
    const tasks = Array.from({ length: 20 }, (_, i) =>
      task({
        code: `01-${String(i).padStart(2, '0')}`,
        is_critical: i % 3 === 0,
        decision_org: i % 2 === 0 ? '브랜드' : '온라인BU',
      }),
    );
    const first = firstLookRows(tasks);
    const rest = restRows(tasks);
    expect(first.length + rest.length).toBe(tasks.length);
    // 겹치는 코드가 없다.
    const firstCodes = new Set(first.map((t) => t.code));
    expect(rest.every((t) => !firstCodes.has(t.code))).toBe(true);
    // 합이 전체 코드 집합과 같다.
    const union = new Set([...first, ...rest].map((t) => t.code));
    expect(union.size).toBe(tasks.length);
  });

  it('is_critical 이 true 여도 결정권이 브랜드가 아니면 먼저 볼 것이 아니다', () => {
    const t = task({ is_critical: true, decision_org: '물류' });
    expect(firstLookRows([t])).toEqual([]);
    expect(restRows([t])).toEqual([t]);
  });

  it('빈 입력에서 안 죽는다', () => {
    expect(firstLookRows([])).toEqual([]);
    expect(firstLookRows(undefined)).toEqual([]);
    expect(firstLookRows(null)).toEqual([]);
    expect(restRows(undefined)).toEqual([]);
  });
});

describe('templateRow', () => {
  it('파서가 읽는 열 이름이 COL 과 같다 — 기한만 사람용으로 더 있다', () => {
    const row = templateRow({ task: task(), openDate: OPEN });
    // COL 의 progress('진행상태')는 v10 을 읽기 위한 것이라 양식에는 없다 —
    // 파서가 없어도 status 만으로 범위를 읽으므로 문제없다. 순서는 안 본다 —
    // toObjects 가 이름으로 열을 찾지 자리로 찾지 않는다(lib/sheetHeader.js).
    const parserKeys = Object.values(COL).filter((name) => name !== COL.progress);
    for (const key of parserKeys) {
      expect(Object.prototype.hasOwnProperty.call(row, key)).toBe(true);
    }
    // 기한은 COL 에 없다(파서가 안 읽음) — 그래도 브랜드가 읽는 것이
    // D-day 가 아니라 이 날짜라서 넣는다.
    expect(Object.prototype.hasOwnProperty.call(row, '기한')).toBe(true);
    expect(Object.keys(row).length).toBe(parserKeys.length + 1);
  });

  it('기한을 오픈일 + D-day 로 계산해 넣는다', () => {
    const row = templateRow({ task: task({ day_offset: -90 }), openDate: OPEN });
    expect(row['D-day']).toBe(-90);
    expect(row['기한']).toBe('2026-10-07');
  });

  it('오픈일이 바뀌면 기한도 따라간다', () => {
    const row = templateRow({ task: task({ day_offset: -90 }), openDate: '2027-02-05' });
    expect(row['기한']).toBe('2026-11-07');
  });

  it('해당없음이 아니면 상태는 해당, 비고는 note 그대로', () => {
    const row = templateRow({
      task: task({ status: '할 것', note: '주의 사항' }),
      openDate: OPEN,
    });
    expect(row['상태']).toBe('해당');
    expect(row['비고']).toBe('주의 사항');
  });

  it('해당없음이면 상태는 해당없음, 비고는 excluded_reason', () => {
    const row = templateRow({
      task: task({ status: '해당없음', note: '원래 비고', excluded_reason: '이 브랜드는 자사몰 없음' }),
      openDate: OPEN,
    });
    expect(row['상태']).toBe('해당없음');
    expect(row['비고']).toBe('이 브랜드는 자사몰 없음');
  });

  it('해당없음인데 excluded_reason 이 비어 있으면 note 로 대신한다', () => {
    const row = templateRow({
      task: task({ status: '해당없음', note: '메모만 있음', excluded_reason: null }),
      openDate: OPEN,
    });
    expect(row['비고']).toBe('메모만 있음');
  });

  it('선행조건을 쉼표로 이어붙인다', () => {
    const row = templateRow({ task: task({ depends_on: ['01-01', '01-02'] }), openDate: OPEN });
    expect(row['선행조건']).toBe('01-01, 01-02');
  });

  it('선행조건이 없으면 빈 문자열', () => {
    const row = templateRow({ task: task({ depends_on: [] }), openDate: OPEN });
    expect(row['선행조건']).toBe('');
  });

  it('빈 입력에서 안 죽는다', () => {
    expect(templateRow({})).toBe(null);
    expect(templateRow({ task: null, openDate: OPEN })).toBe(null);
    expect(templateRow()).toBe(null);
  });

  it('오픈일이 없거나 잘못돼도 죽지 않고 기한만 빈 값', () => {
    const row = templateRow({ task: task(), openDate: null });
    expect(row['기한']).toBe('');
    const row2 = templateRow({ task: task(), openDate: '잘못된 날짜' });
    expect(row2['기한']).toBe('');
  });
});

describe('optionsFrom', () => {
  it('워크스트림·역할·조직·채널 후보를 항목에서 뽑는다', () => {
    const tasks = [
      task({
        workstream: '01_신규법인',
        owner_role: '법무',
        support_role: '재무',
        owner_org: '지원조직',
        decision_org: '브랜드',
        channel: '공통',
      }),
      task({
        workstream: '02_상품',
        owner_role: 'MD',
        support_role: null,
        owner_org: '브랜드',
        decision_org: '온라인BU',
        channel: '자사몰',
      }),
    ];
    const options = optionsFrom(tasks);
    expect(options.workstreams).toEqual(['01_신규법인', '02_상품']);
    expect(options.roles.sort()).toEqual(['MD', '법무', '재무'].sort());
    expect(new Set(options.orgs)).toEqual(new Set(['지원조직', '브랜드', '온라인BU']));
    expect(options.channels.sort()).toEqual(['공통', '자사몰'].sort());
  });

  it('중복을 한 번만 담는다', () => {
    const tasks = [task(), task(), task()];
    const options = optionsFrom(tasks);
    expect(options.roles.length).toBe(2); // 법무, 재무
    expect(options.workstreams.length).toBe(1);
  });

  it('비었거나 null 인 값은 후보에 안 들어간다', () => {
    const tasks = [task({ support_role: null, channel: '' })];
    const options = optionsFrom(tasks);
    expect(options.roles).toEqual(['법무']);
    expect(options.channels).toEqual([]);
  });

  it('빈 입력에서 안 죽는다', () => {
    expect(optionsFrom([])).toEqual({ workstreams: [], roles: [], orgs: [], channels: [] });
    expect(optionsFrom(undefined)).toEqual({ workstreams: [], roles: [], orgs: [], channels: [] });
  });
});
