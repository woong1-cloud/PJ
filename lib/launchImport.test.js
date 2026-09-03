import { describe, expect, it } from 'vitest';
import {
  isTaskSheet,
  parseDeps,
  parseRow,
  parseSheet,
  parseWorkbook,
  planImport,
} from './launchImport';

// v10 의 실제 머리 행과 한 줄. 배열로 온다(`header: 1`).
const HEADER = [
  'ID','결정권','소속','주관','지원','대분류','체크 항목','채널',
  '선행조건','D-day','기한','상태','산출물/증빙','비고','진행상태',
];
const CELLS = [
  '01-02','CAIO실','지원조직','법무','재무','법인/자격',
  '사업자등록 (업태·종목에 전자상거래·통신판매 포함 여부 확인)','공통',
  '01-01', -115, '2026-09-12', '미착수', '사업자등록증', '종목 누락 시 채널 심사 반려', '',
];
// 열 이름 → 배열 자리. 검사에서 한 칸만 바꿔 넣을 때 쓴다.
const AT = Object.fromEntries(HEADER.map((n, i) => [n, i]));
const cells = (over = {}) => {
  const row = [...CELLS];
  for (const [k, v] of Object.entries(over)) row[AT[k]] = v;
  return row;
};
// parseRow 는 객체 행을 받는다(toObjects 가 만들어 준 모양).
const ROW = Object.fromEntries(HEADER.map((n, i) => [n, CELLS[i]]));

describe('isTaskSheet', () => {
  // 이름이 아니라 머리 행이 정한다.
  //
  // 이름 규칙(/^(0[1-9]|1[0-8])_/)이 통합 WBS 에서 두 번 틀렸다 —
  // 01_WBS 를 항목 시트로 오인했고 D01~D19 를 건너뛰었다. 'D' 를 정규식에
  // 더하는 것은 같은 실수를 한 번 더 하는 것이다. 다음 파일은 또 다른
  // 이름을 쓴다.
  it('머리 행이 있으면 이름과 무관하게 항목 시트다', () => {
    expect(isTaskSheet({ name: 'D01_법인·행정', rows: [HEADER] })).toBe(true);
    expect(isTaskSheet({ name: '01_신규법인', rows: [HEADER] })).toBe(true);
    expect(isTaskSheet({ name: '아무이름', rows: [HEADER] })).toBe(true);
  });

  it('머리 행이 없으면 아니다 — 01_WBS · 02_간트 가 여기서 빠진다', () => {
    const wbs = ['ID', '구분', '핵심 과업', '쉬운 설명', '주관', '담당자', '참여'];
    const gantt = ['ID', '구분', '핵심 과업', '주관', '담당자', '시작', '종료', '상태'];
    expect(isTaskSheet({ name: '01_WBS', rows: [wbs] })).toBe(false);
    expect(isTaskSheet({ name: '02_간트', rows: [gantt] })).toBe(false);
    expect(isTaskSheet({ name: '00_개요', rows: [['제목만']] })).toBe(false);
  });

  it('제목 줄이 위에 붙어 있어도 찾는다', () => {
    expect(isTaskSheet({ name: 'D05', rows: [['상품 콘텐츠'], [], HEADER] })).toBe(true);
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(isTaskSheet({ name: 'X', rows: [] })).toBe(false);
    expect(isTaskSheet({})).toBe(false);
    expect(isTaskSheet()).toBe(false);
  });
});

describe('parseRow', () => {
  it('v10 의 열을 읽는다', () => {
    const item = parseRow({ sheetName: '01_신규법인', row: ROW, index: 1 });
    expect(item).toMatchObject({
      code: '01-02',
      workstream: '01_신규법인',
      category: '법인/자격',
      channel: '공통',
      decision_org: 'CAIO실',
      owner_org: '지원조직',
      owner_role: '법무',
      support_role: '재무',
      depends_on: ['01-01'],
      day_offset: -115,
      deliverable: '사업자등록증',
      is_critical: false,
      sort_order: 1,
    });
  });

  it('기한 열은 읽지 않는다 — 값이 달라도 결과가 같다', () => {
    // 이 검사가 이 파일의 핵심이다. 기한을 저장하면 오픈일이 바뀔 때
    // 403건이 안 따라온다.
    const a = parseRow({ sheetName: '01_신규법인', row: ROW });
    const b = parseRow({ sheetName: '01_신규법인', row: { ...ROW, 기한: '1999-01-01' } });
    expect(a).toEqual(b);
    expect(a).not.toHaveProperty('due_date');
    expect(a).not.toHaveProperty('기한');
  });

  it('상태·진행상태 열도 읽지 않는다 — 시트의 상태는 대개 낡았다', () => {
    const item = parseRow({ sheetName: '01_신규법인', row: { ...ROW, 상태: '완료' } });
    expect(item).not.toHaveProperty('status');
  });

  it('★ 를 비고에서 읽는다', () => {
    const item = parseRow({
      sheetName: '02_양수·라이선스',
      row: { ...ROW, 비고: '★ 네이버·무신사 심사 반려 방지 핵심 서류' },
    });
    expect(item.is_critical).toBe(true);
  });

  it('D-day 가 없으면 그 행을 버린다', () => {
    // 기한을 셀 수 없는 항목은 보드에 놓을 자리가 없다. 조용히 D0 으로 두면
    // 오픈일에 몰린다.
    expect(parseRow({ sheetName: '01_신규법인', row: { ...ROW, 'D-day': null } })).toBe(null);
    expect(parseRow({ sheetName: '01_신규법인', row: { ...ROW, 'D-day': '' } })).toBe(null);
  });

  it('문자열 D-day 도 읽는다', () => {
    expect(parseRow({ sheetName: '01_신규법인', row: { ...ROW, 'D-day': '-115' } }).day_offset).toBe(
      -115,
    );
  });

  it('머리 행과 빈 행은 걸러진다', () => {
    expect(parseRow({ sheetName: '01_신규법인', row: { ID: 'ID', '체크 항목': '체크 항목' } })).toBe(
      null,
    );
    expect(parseRow({ sheetName: '01_신규법인', row: {} })).toBe(null);
    expect(parseRow({ sheetName: '01_신규법인', row: { ...ROW, '체크 항목': '' } })).toBe(null);
  });

  it('빈 칸은 null 로 — 빈 문자열을 저장하면 화면에서 구분이 안 된다', () => {
    const item = parseRow({
      sheetName: '01_신규법인',
      row: { ...ROW, 비고: '', '산출물/증빙': '   ' },
    });
    expect(item.note).toBe(null);
    expect(item.deliverable).toBe(null);
  });
});

describe('parseDeps', () => {
  it('하나든 여럿이든 코드만 뽑는다', () => {
    expect(parseDeps('01-01')).toEqual(['01-01']);
    expect(parseDeps('01-01, 01-02')).toEqual(['01-01', '01-02']);
    expect(parseDeps('01-01/02-03')).toEqual(['01-01', '02-03']);
  });

  it('코드 모양이 아닌 것은 버린다', () => {
    // '없음', '해당없음' 같은 값이 실제로 들어온다.
    expect(parseDeps('없음')).toEqual([]);
    expect(parseDeps('')).toEqual([]);
    expect(parseDeps(null)).toEqual([]);
  });
});

describe('parseSheet · parseWorkbook', () => {
  it('머리 행을 찾아 읽는다', () => {
    expect(parseSheet({ sheetName: '01_신규법인', rows: [HEADER, cells()] })).toHaveLength(1);
  });

  it('머리 위에 제목 줄이 있어도 읽는다', () => {
    // 24_R&R분배 가 실제로 그렇고, 워크스트림 시트에도 언젠가 붙을 수 있다.
    // 1행을 머리로 가정하면 그날 403건이 통째로 0이 된다.
    const rows = [['신규 브랜드 온라인 오픈 체크리스트'], [], HEADER, cells()];
    expect(parseSheet({ sheetName: '01_신규법인', rows })).toHaveLength(1);
  });

  it('머리를 못 찾으면 빈 배열 — 순서로 억지로 읽지 않는다', () => {
    // 열이 하나 밀린 채 403건이 들어가는 것이 최악이다.
    expect(parseSheet({ sheetName: '01_신규법인', rows: [['가', '나'], ['1', '2']] })).toEqual([]);
  });

  it('워크북에서 건너뛴 시트 이름을 돌려준다', () => {
    // 21·24 는 이름이 아니라 머리 행이 달라서 빠진다 — ID·체크 항목·D-day
    // 셋을 다 갖추지 못한 시트다. 이름을 봐서 거르는 옛 규칙으로 되돌아가지
    // 않도록, 일부러 항목 시트 머리 행이 아닌 것을 준다.
    const out = parseWorkbook([
      { name: '01_신규법인', rows: [HEADER, cells()] },
      { name: '21_진척률', rows: [['ID', '구분', '진척률']] },
      { name: '24_R&R분배', rows: [['역할', '담당자', '연락처']] },
    ]);
    expect(out.items).toHaveLength(1);
    expect(out.skipped).toEqual(['21_진척률', '24_R&R분배']);
  });

  it('같은 코드가 두 번 오면 뒤엣것이 이긴다', () => {
    // 시트를 손보다 행을 복사한 흔적이 남을 수 있다. 앞엣것이 이기면 고친
    // 쪽이 버려진다.
    const out = parseWorkbook([
      { name: '01_신규법인', rows: [HEADER, cells(), cells({ '체크 항목': '고친 제목' })] },
    ]);
    expect(out.items).toHaveLength(1);
    expect(out.items[0].title).toBe('고친 제목');
    expect(out.duplicates).toBe(1);
  });

  it('빈 워크북에서 죽지 않는다', () => {
    expect(parseWorkbook([]).items).toEqual([]);
    expect(parseWorkbook().items).toEqual([]);
  });
});

describe('planImport', () => {
  const a = { code: '01-01', title: 'A' };
  const b = { code: '01-02', title: 'B' };

  it('새것과 갱신을 가른다', () => {
    const plan = planImport({ incoming: [a, b], existing: [{ code: '01-01', title: '옛 A' }] });
    expect(plan.create.map((x) => x.code)).toEqual(['01-02']);
    expect(plan.update.map((x) => x.code)).toEqual(['01-01']);
  });

  it('시트에서 빠진 것은 지우지 않는다 — 지우는 것은 손으로 한다', () => {
    const plan = planImport({ incoming: [a], existing: [a, { code: '99-99', title: '옛것' }] });
    expect(plan.missing).toEqual(['99-99']);
    expect(plan.create).toEqual([]);
  });

  it('처음 가져오면 전부 새것', () => {
    const plan = planImport({ incoming: [a, b], existing: [] });
    expect(plan.create).toHaveLength(2);
    expect(plan.update).toHaveLength(0);
  });

  it('빈 입력에서 죽지 않는다', () => {
    expect(planImport({})).toEqual({ create: [], update: [], missing: [] });
    expect(planImport()).toEqual({ create: [], update: [], missing: [] });
  });
});
