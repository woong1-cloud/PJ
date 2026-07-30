import { describe, it, expect } from 'vitest';
import {
  MENTION_CANDIDATE_LIMIT,
  filterMentionCandidates,
  findMentionQuery,
  findUnmatchedMentions,
  parseMentions,
  splitMentions,
} from './mentions';

// 이 파일의 대부분은 "@이름 뒤에 조사가 붙는다"는 한 가지 사실에서 나온다.
// 한국어는 이름과 조사 사이에 공백이 없다 — '@김관리님이'. 공백으로 잘라
// 이름을 얻는 흔한 구현은 여기서 '김관리님이'라는, 아무와도 맞지 않는 이름을
// 만들어내고 멘션은 조용히 사라진다. 알림이 안 갔는데 보낸 사람은 갔다고
// 믿는 것이 이 기능에서 제일 나쁜 실패다.
const 김관리 = { id: 'm1', name: '김관리' };
const 박스파오 = { id: 'm2', name: '박스파오' };
const MEMBERS = [김관리, 박스파오];

describe('parseMentions — 조사가 붙어도 이름을 찾는다', () => {
  it('이름 바로 뒤에 조사가 붙어도 사람을 찾아낸다', () => {
    expect(parseMentions('@김관리님이 확인해주세요', MEMBERS)).toEqual([김관리]);
    expect(parseMentions('@박스파오도 봐주세요', MEMBERS)).toEqual([박스파오]);
    expect(parseMentions('@김관리는 어떻게 생각하세요?', MEMBERS)).toEqual([김관리]);
  });

  it('문장 끝에 이름만 있어도 찾는다', () => {
    expect(parseMentions('확인 부탁드립니다 @김관리', MEMBERS)).toEqual([김관리]);
    expect(parseMentions('@김관리', MEMBERS)).toEqual([김관리]);
  });

  it('한 코멘트에 여러 명을 부를 수 있다', () => {
    expect(parseMentions('@김관리님 @박스파오님 같이 보시죠', MEMBERS)).toEqual([김관리, 박스파오]);
  });

  it('같은 사람을 두 번 불러도 알림은 한 번이다', () => {
    expect(parseMentions('@김관리 이거 보시고 @김관리님 회신 주세요', MEMBERS)).toEqual([김관리]);
  });

  it('줄바꿈으로 나뉜 멘션도 찾는다', () => {
    expect(parseMentions('@김관리님\n@박스파오님', MEMBERS)).toEqual([김관리, 박스파오]);
  });
});

describe('parseMentions — 매칭되지 않는 경우', () => {
  it('@ 뒤에 아무것도 없으면 멘션이 아니다', () => {
    expect(parseMentions('@', MEMBERS)).toEqual([]);
    expect(parseMentions('메일 주소는 @ 다음에 쓰세요', MEMBERS)).toEqual([]);
  });

  it('모르는 이름은 멘션이 아니다 (터지지도 않는다)', () => {
    expect(parseMentions('@없는사람님이 봐주세요', MEMBERS)).toEqual([]);
    expect(parseMentions('@1234', MEMBERS)).toEqual([]);
  });

  // 본문에 적힌 메일 주소가 멘션으로 읽히면, 이름이 겹치는 순간 엉뚱한
  // 사람에게 알림이 간다. @ 앞이 글자·숫자면 멘션으로 보지 않는다.
  it('본문 속 이메일 주소는 멘션이 아니다', () => {
    const withB = [...MEMBERS, { id: 'm3', name: 'b' }];
    expect(parseMentions('연락은 a@b.com 으로 주세요', withB)).toEqual([]);
    expect(parseMentions('spao.kim+dev@b.com', withB)).toEqual([]);
  });

  it('본문이 비어 있거나 문자열이 아니어도 터지지 않는다', () => {
    expect(parseMentions('', MEMBERS)).toEqual([]);
    expect(parseMentions(null, MEMBERS)).toEqual([]);
    expect(parseMentions(undefined, MEMBERS)).toEqual([]);
  });

  it('멤버 목록이 비어 있거나 이상해도 터지지 않는다', () => {
    expect(parseMentions('@김관리님이', [])).toEqual([]);
    expect(parseMentions('@김관리님이', null)).toEqual([]);
    // 이름이 빈 멤버는 건너뛴다. 빈 문자열은 모든 위치에서 startsWith 를
    // 통과해서, 그냥 두면 '@' 하나가 그 사람 멘션이 되어버린다.
    expect(parseMentions('@김관리님이', [{ id: 'x', name: '' }, 김관리])).toEqual([김관리]);
    expect(parseMentions('@김관리님이', [{ id: 'x' }, 김관리])).toEqual([김관리]);
  });
});

describe('parseMentions — 이름이 겹칠 때', () => {
  // 짧은 이름이 먼저 걸리면 '@김민수'가 김민에게 간다. 항상 가장 긴 이름부터
  // 맞춰본다.
  it('한 이름이 다른 이름의 앞부분이면 긴 쪽을 고른다', () => {
    const 김민 = { id: 'a', name: '김민' };
    const 김민수 = { id: 'b', name: '김민수' };
    expect(parseMentions('@김민수님이', [김민, 김민수])).toEqual([김민수]);
    expect(parseMentions('@김민수님이', [김민수, 김민])).toEqual([김민수]);
    // 짧은 쪽을 부르는 것도 여전히 된다.
    expect(parseMentions('@김민님이', [김민, 김민수])).toEqual([김민]);
  });

  // 동명이인은 이름만으로 가릴 수 없다. 둘 다에게 보낸다 — 한 명이 헛알림을
  // 받는 것보다, 정작 불린 사람이 아무 알림도 못 받는 편이 훨씬 나쁘다.
  it('동명이인은 두 사람 모두 부른다', () => {
    const a = { id: 'a', name: '김민수' };
    const b = { id: 'b', name: '김민수' };
    expect(parseMentions('@김민수님 확인 부탁', [a, b])).toEqual([a, b]);
  });

  it('같은 사람이 목록에 두 번 들어 있어도 한 번만 돌려준다', () => {
    expect(parseMentions('@김관리', [김관리, { ...김관리 }])).toEqual([김관리]);
  });
});

describe('splitMentions — 화면에 칠하기 위한 조각내기', () => {
  it('본문을 텍스트와 멘션 조각으로 나눈다', () => {
    expect(splitMentions('앞 @김관리님이 뒤', MEMBERS)).toEqual([
      { type: 'text', text: '앞 ' },
      { type: 'mention', text: '@김관리', name: '김관리', members: [김관리] },
      { type: 'text', text: '님이 뒤' },
    ]);
  });

  it('멘션이 없으면 통짜 텍스트 하나다', () => {
    expect(splitMentions('그냥 코멘트', MEMBERS)).toEqual([{ type: 'text', text: '그냥 코멘트' }]);
  });

  it('빈 본문은 조각이 없다', () => {
    expect(splitMentions('', MEMBERS)).toEqual([]);
  });

  // 칠하는 규칙과 알리는 규칙이 어긋나면 "파랗게 칠해졌는데 알림은 안 왔다"가
  // 된다. 두 함수가 같은 매칭을 쓰는지 여기서 못 박는다.
  it('칠하는 규칙과 부르는 규칙이 같다', () => {
    const body = '@김관리님이 a@b.com 으로 @박스파오도';
    const painted = splitMentions(body, MEMBERS)
      .filter((s) => s.type === 'mention')
      .flatMap((s) => s.members);
    expect(painted).toEqual(parseMentions(body, MEMBERS));
  });
});

describe('findMentionQuery — 입력창에서 지금 @를 치는 중인가', () => {
  it('커서 앞의 @부터 커서까지를 검색어로 준다', () => {
    expect(findMentionQuery('안녕 @김', 5)).toEqual({ start: 3, query: '김' });
    expect(findMentionQuery('@', 1)).toEqual({ start: 0, query: '' });
  });

  it('커서를 안 주면 문자열 끝으로 본다', () => {
    expect(findMentionQuery('안녕 @김관')).toEqual({ start: 3, query: '김관' });
  });

  it('@와 커서 사이에 공백이 있으면 입력 중이 아니다', () => {
    expect(findMentionQuery('@김관리 확인', 8)).toBeNull();
    expect(findMentionQuery('@김관리\n다음줄', 8)).toBeNull();
  });

  it('@가 없으면 null', () => {
    expect(findMentionQuery('그냥 코멘트', 5)).toBeNull();
    expect(findMentionQuery('', 0)).toBeNull();
    expect(findMentionQuery(null, 0)).toBeNull();
  });

  // 메일 주소를 치는 도중에 멘션 목록이 튀어나오면 안 된다.
  it('이메일을 치는 중에는 열리지 않는다', () => {
    expect(findMentionQuery('a@b', 3)).toBeNull();
  });

  it('커서 뒤의 글자는 검색어에 넣지 않는다', () => {
    expect(findMentionQuery('@김관리님이', 3)).toEqual({ start: 0, query: '김관' });
  });
});

describe('filterMentionCandidates', () => {
  const many = [
    { id: '1', name: '김관리' },
    { id: '2', name: '김민수' },
    { id: '3', name: '박스파오' },
  ];

  it('검색어가 비면 전부 보여준다', () => {
    expect(filterMentionCandidates(many, '')).toEqual(many);
  });

  it('이름 일부로 걸러낸다', () => {
    expect(filterMentionCandidates(many, '김')).toEqual([many[0], many[1]]);
    expect(filterMentionCandidates(many, '민수')).toEqual([many[1]]);
  });

  it('앞부분이 맞는 사람을 먼저 보여준다', () => {
    const list = [
      { id: '1', name: '이수민' },
      { id: '2', name: '수민' },
    ];
    expect(filterMentionCandidates(list, '수민')).toEqual([list[1], list[0]]);
  });

  it('맞는 사람이 없으면 빈 배열', () => {
    expect(filterMentionCandidates(many, '없는사람')).toEqual([]);
    expect(filterMentionCandidates(null, '김')).toEqual([]);
  });

  it('목록이 길어도 상한까지만 보여준다', () => {
    const lots = Array.from({ length: 30 }, (_, i) => ({ id: String(i), name: `김${i}` }));
    expect(filterMentionCandidates(lots, '김').length).toBe(MENTION_CANDIDATE_LIMIT);
  });
});

describe('findUnmatchedMentions', () => {
  const members = [
    { id: 'a', name: '김관리' },
    { id: 'b', name: '박스파오' },
  ];

  it('맞은 멘션만 있으면 경고할 게 없다', () => {
    expect(findUnmatchedMentions('@김관리 확인 부탁', members)).toEqual([]);
  });

  // 실제로 겪은 상황: 다른 브랜드 소속을 부르면 조용히 사라졌다.
  it('명부에 없는 이름을 잡아낸다', () => {
    expect(findUnmatchedMentions('@가입테스트 확인 부탁', members)).toEqual(['가입테스트']);
  });

  it('맞은 것과 안 맞은 것이 섞여 있어도 안 맞은 것만 돌려준다', () => {
    expect(findUnmatchedMentions('@김관리 님과 @없는사람 께', members)).toEqual(['없는사람']);
  });

  it('같은 이름을 두 번 틀려도 한 번만 알린다', () => {
    expect(findUnmatchedMentions('@없는사람 @없는사람', members)).toEqual(['없는사람']);
  });

  it('이메일 주소는 경고하지 않는다', () => {
    expect(findUnmatchedMentions('문의는 a@b.com 으로', members)).toEqual([]);
  });

  it('@ 하나만 쳤을 때는 아직 쓰는 중이므로 경고하지 않는다', () => {
    expect(findUnmatchedMentions('@', members)).toEqual([]);
    expect(findUnmatchedMentions('@ 확인', members)).toEqual([]);
  });

  // 긴 이름이 맞으면 그 뒤부터 다시 본다 — 맞은 이름의 일부를 다시 훑어
  // 엉뚱한 경고를 내면 안 된다.
  it('맞은 이름 뒤에 조사가 붙어도 경고하지 않는다', () => {
    expect(findUnmatchedMentions('@박스파오님이 확인', members)).toEqual([]);
  });

  it('명부가 비어 있으면 모든 @이름이 경고 대상이다', () => {
    expect(findUnmatchedMentions('@김관리', [])).toEqual(['김관리']);
  });
});
