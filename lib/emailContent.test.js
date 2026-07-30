import { describe, it, expect } from 'vitest';
import {
  EMAIL_EVENTS,
  absoluteUrl,
  assigneeEmail,
  mentionEmail,
  signupEmail,
} from './emailContent';

const BASE = 'https://moa.example.com';

describe('EMAIL_EVENTS', () => {
  it('메일로 나가는 사건은 셋뿐이다', () => {
    // 늘리려면 의도적으로 늘려야 한다. 하나씩 슬쩍 붙다 보면 어느새 인앱
    // 알림 전부가 메일로 나가고, 그때는 아무도 이 메일을 안 읽는다.
    expect(EMAIL_EVENTS).toEqual(['배치대기', '담당자지정', '멘션']);
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
    affiliation: '브랜드',
    brandName: '스파오',
    baseUrl: BASE,
  });

  it('제목만 보고 무슨 일인지 알 수 있다', () => {
    expect(mail.subject).toBe('[모아 MOA] 배치 대기 — 김지원님 가입');
  });

  it('본문에 배치 화면 링크가 있다', () => {
    expect(mail.text).toContain('https://moa.example.com/admin/members');
  });

  it('본부 소속이면 브랜드 없이 쓴다', () => {
    const m = signupEmail({ name: '김지원', affiliation: '본부', brandName: null, baseUrl: BASE });
    expect(m.text).toContain('본부 소속으로 가입했습니다');
  });

  it('베이스를 모르면 링크 없이 본문만 만든다', () => {
    const m = signupEmail({ name: '김지원', affiliation: '본부', baseUrl: null });
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
