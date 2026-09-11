import { describe, it, expect } from 'vitest';
import {
  EMAIL_EVENTS,
  absoluteUrl,
  assigneeEmail,
  helpRequestEmail,
  mentionEmail,
  signupEmail,
} from './emailContent';

const BASE = 'https://moa.example.com';

describe('EMAIL_EVENTS', () => {
  it('메일로 나가는 사건은 일곱이다', () => {
    // 늘리려면 의도적으로 늘려야 한다. 하나씩 슬쩍 붙다 보면 어느새 인앱
    // 알림 전부가 메일로 나가고, 그때는 아무도 이 메일을 안 읽는다.
    //
    // 2026-08 에 회의안건·회의배정을 의도적으로 늘렸다. 둘 다 주 1회 상한이
    // 있고 회의라는 자리에 묶여 있어, 사건마다 나가는 알림과 성격이 다르다.
    //
    // '의견'도 같은 달에 의도적으로 늘렸다. 상한은 사람 수가 대신한다 —
    // 활성 19명에 실사용 4명이라 주 1~2건을 넘기 어렵고, 받는 사람도 전체
    // 관리자 넷 이하다.
    //
    // '요건확인'도 같은 판단으로 늘렸다. 요청자가 답을 안 주면 그 건이
    // 멈추므로 "지금 당신이 뭘 해야 하는" 것이 맞고, 상한은 건당 1통이다.
    expect(EMAIL_EVENTS).toEqual([
      '배치대기',
      '담당자지정',
      '멘션',
      '회의안건',
      '회의배정',
      '의견',
      '요건확인',
    ]);
  });
});

describe('absoluteUrl', () => {
  it('베이스와 경로를 잇는다', () => {
    expect(absoluteUrl(BASE, '/admin/members')).toBe('https://moa.example.com/admin/members');
  });

  it('베이스 끝의 슬래시가 겹치지 않는다', () => {
    expect(absoluteUrl('https://moa.example.com/', '/admin/members')).toBe(
      'https://moa.example.com/admin/members'
    );
  });

  it('앞에 슬래시가 없는 경로도 받는다', () => {
    expect(absoluteUrl(BASE, 'admin/members')).toBe('https://moa.example.com/admin/members');
  });

  it('베이스를 모르면 null 이다 — 깨진 링크를 메일에 넣지 않는다', () => {
    expect(absoluteUrl(null, '/admin/members')).toBe(null);
    expect(absoluteUrl('', '/admin/members')).toBe(null);
  });
});

describe('signupEmail', () => {
  const mail = signupEmail({
    name: '김지원',
    organizationName: '스파오',
    baseUrl: BASE,
  });

  it('제목만 보고 무슨 일인지 알 수 있다', () => {
    expect(mail.subject).toBe('[모아 MOA] 배치 대기 — 김지원님 가입');
  });

  it('본문에 배치 화면 링크가 있다', () => {
    expect(mail.text).toContain('https://moa.example.com/settings/members');
  });

  it('브랜드가 아닌 조직도 같은 문장이다', () => {
    const m = signupEmail({ name: '김지원', organizationName: '법무팀', baseUrl: BASE });
    expect(m.text).toContain('법무팀 소속으로 가입했습니다');
  });

  it('조직 이름을 모르면 그렇다고 적는다 — 빈 자리를 남기지 않는다', () => {
    // '님이  소속으로 가입했습니다' 처럼 공백이 뚫린 문장이 나가면
    // 받는 사람은 앱이 값을 잃어버린 것으로 읽는다.
    const m = signupEmail({ name: '김지원', baseUrl: BASE });
    expect(m.text).toContain('소속 미상 소속으로 가입했습니다');
  });

  it('베이스를 모르면 링크 없이 본문만 만든다', () => {
    const m = signupEmail({ name: '김지원', organizationName: '법무팀', baseUrl: null });
    expect(m.text).not.toContain('http');
    expect(m.text).toContain('가입했습니다');
  });
});

describe('assigneeEmail', () => {
  const mail = assigneeEmail({
    title: '장바구니 쿠폰 중복적용 오류',
    assignerName: '박실무',
    requirementId: 'r1',
    baseUrl: BASE,
  });

  it('제목에 요구사항 제목이 들어간다', () => {
    expect(mail.subject).toBe('[모아 MOA] 담당자 지정 — 장바구니 쿠폰 중복적용 오류');
  });

  it('긴 제목은 말줄임한다', () => {
    const long = '가'.repeat(60);
    const m = assigneeEmail({ title: long, requirementId: 'r1', baseUrl: BASE });
    expect(m.subject).toContain('…');
    expect(m.subject.length).toBeLessThan(long.length);
  });

  it('본문은 해당 요구사항으로 링크한다', () => {
    expect(mail.text).toContain('https://moa.example.com/requirements/r1');
  });

  it('지정한 사람을 몰라도 문장이 깨지지 않는다', () => {
    const m = assigneeEmail({ title: '오류', requirementId: 'r1', baseUrl: BASE });
    expect(m.text).toContain('회원님을 다음 요구사항의 담당자로 지정했습니다');
    expect(m.text).not.toContain('undefined');
  });
});

describe('mentionEmail', () => {
  it('누가 불렀는지 본문에 있다', () => {
    const m = mentionEmail({
      title: '결제 오류',
      actorName: '박실무',
      requirementId: 'r2',
      baseUrl: BASE,
    });
    expect(m.subject).toBe('[모아 MOA] 언급됨 — 결제 오류');
    expect(m.text).toContain('박실무님이 코멘트에서 회원님을 언급했습니다');
    expect(m.text).toContain('https://moa.example.com/requirements/r2');
  });

  it('이름을 모르면 "님이"로 시작하지 않는다', () => {
    const m = mentionEmail({ title: '결제 오류', requirementId: 'r2', baseUrl: BASE });
    expect(m.text).toContain('누군가 코멘트에서');
  });
});


describe('helpRequestEmail', () => {
  const TASKS = [
    { code: 'DEV-01', title: '상세페이지 오픈' },
    { code: 'DEV-02', title: '결제 연동' },
  ];

  it('항목이 하나면 제목에 코드가 들어가고 그 항목으로 링크한다', () => {
    // 메일함에서 제목만 보고 무엇에 대한 것인지 알아야 열린다. 런칭 항목
    // 제목은 짧고 여러 런칭에 같은 것이 있어서 코드가 그 구분을 한다.
    const m = helpRequestEmail({
      tasks: [TASKS[0]],
      roles: ['결정권'],
      actorName: '박실무',
      launchId: 'l1',
      launchName: '가을 런칭',
      baseUrl: BASE,
    });
    expect(m.subject).toBe('[모아 MOA] 협조 요청 — DEV-01 상세페이지 오픈');
    expect(m.text).toContain('https://moa.example.com/launch/l1?task=DEV-01');
    expect(m.text).toContain('박실무님이 결정권에 협조를 요청했습니다');
  });

  it('항목이 여럿이면 제목은 「N건」이고 링크는 런칭이다', () => {
    // 어느 하나를 골라 링크할 수 없다. 보드로 보내면 고른 것들이 다 보인다.
    const m = helpRequestEmail({
      tasks: TASKS,
      roles: ['결정권', '개발'],
      actorName: '박실무',
      launchId: 'l1',
      launchName: '가을 런칭',
      baseUrl: BASE,
    });
    expect(m.subject).toBe('[모아 MOA] 협조 요청 — 가을 런칭 2건');
    expect(m.text).toContain('https://moa.example.com/launch/l1');
    expect(m.text).not.toContain('?task=');
    expect(m.text).toContain('· DEV-01 상세페이지 오픈');
    expect(m.text).toContain('· DEV-02 결제 연동');
    expect(m.text).toContain('결정권 · 개발에 협조를 요청했습니다');
  });

  it('한마디가 비면 인용줄이 안 생긴다 — 빈 따옴표를 남기지 않는다', () => {
    const m = helpRequestEmail({
      tasks: [TASKS[0]],
      roles: ['결정권'],
      actorName: '박실무',
      launchId: 'l1',
      launchName: '가을 런칭',
      message: '   ',
      baseUrl: BASE,
    });
    expect(m.text).not.toContain('"');
  });

  it('한마디가 있으면 본문에 인용한다', () => {
    const m = helpRequestEmail({
      tasks: [TASKS[0]],
      roles: ['결정권'],
      launchId: 'l1',
      message: '내일까지 답 주세요',
      baseUrl: BASE,
    });
    expect(m.text).toContain('"내일까지 답 주세요"');
  });

  it('보낸 사람을 몰라도 문장이 깨지지 않는다', () => {
    const m = helpRequestEmail({
      tasks: [TASKS[0]],
      roles: ['결정권'],
      launchId: 'l1',
      baseUrl: BASE,
    });
    expect(m.text).toContain('누군가 결정권에 협조를 요청했습니다');
    expect(m.text).not.toContain('undefined');
  });

  it('런칭 이름을 몰라도 제목에 undefined 가 안 나온다', () => {
    const m = helpRequestEmail({ tasks: TASKS, roles: ['개발'], launchId: 'l1', baseUrl: BASE });
    expect(m.subject).toBe('[모아 MOA] 협조 요청 — 런칭 2건');
  });

  it('코드에 들어간 특수문자는 링크에서 인코딩한다', () => {
    const m = helpRequestEmail({
      tasks: [{ code: 'A B', title: '오픈' }],
      roles: ['개발'],
      launchId: 'l1',
      baseUrl: BASE,
    });
    expect(m.text).toContain('/launch/l1?task=A%20B');
  });
});
