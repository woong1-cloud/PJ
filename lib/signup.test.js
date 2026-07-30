import { describe, it, expect } from 'vitest';
import { suggestTier, isAllowedEmail, AFFILIATIONS, JOB_ROLES } from './signup';

describe('suggestTier', () => {
  it('브랜드 소속은 요청자(4차)로 제안한다', () => {
    expect(suggestTier('브랜드')).toBe('4차');
  });

  it('본부 소속은 실무자(3차)로 제안한다', () => {
    expect(suggestTier('본부')).toBe('3차');
  });

  // 제안값이 없을 때 높은 등급으로 떨어지면 권한이 새어 나간다.
  it('모르는 소속은 가장 낮은 등급으로 떨어진다', () => {
    expect(suggestTier('알수없음')).toBe('4차');
    expect(suggestTier(null)).toBe('4차');
  });

  it('관리자 등급(2차·1차)은 절대 제안하지 않는다', () => {
    for (const a of [...AFFILIATIONS, null, '이상한값']) {
      expect(['3차', '4차']).toContain(suggestTier(a));
    }
  });

  // Object.prototype 의 키를 소속으로 넘겨도 등급이 새어 나오면 안 된다.
  it('프로토타입 체인의 키는 등급이 되지 않는다', () => {
    expect(suggestTier('toString')).toBe('4차');
    expect(suggestTier('constructor')).toBe('4차');
  });
});

describe('JOB_ROLES', () => {
  it('직무 목록은 화면·API·DB 제약이 같은 값을 쓴다', () => {
    expect(JOB_ROLES).toEqual(['기획자', '개발자', '디자이너', '기타']);
  });
});

describe('isAllowedEmail', () => {
  const allowed = ['eland.co.kr'];

  it('허용 도메인이면 통과한다', () => {
    expect(isAllowedEmail('hong@eland.co.kr', allowed)).toBe(true);
  });

  it('대소문자가 섞여도 통과한다', () => {
    expect(isAllowedEmail('Hong@ELAND.co.kr', allowed)).toBe(true);
  });

  it('다른 도메인은 막는다', () => {
    expect(isAllowedEmail('hong@gmail.com', allowed)).toBe(false);
  });

  // 'evil-eland.co.kr' 같은 도메인이 통과하면 안 된다.
  it('허용 도메인을 접미사로만 포함하는 주소는 막는다', () => {
    expect(isAllowedEmail('hong@evil-eland.co.kr', allowed)).toBe(false);
    expect(isAllowedEmail('hong@eland.co.kr.evil.com', allowed)).toBe(false);
  });

  it('@ 가 없거나 비어 있으면 막는다', () => {
    expect(isAllowedEmail('hong', allowed)).toBe(false);
    expect(isAllowedEmail('', allowed)).toBe(false);
    expect(isAllowedEmail(null, allowed)).toBe(false);
  });

  // 로컬 파트가 없는 '@eland.co.kr' 은 주소가 아니다.
  it('로컬 파트가 비면 막는다', () => {
    expect(isAllowedEmail('@eland.co.kr', allowed)).toBe(false);
  });

  // 허용 목록이 비어 있으면 아무도 통과하지 못한다 —
  // 설정 실수로 전면 개방되는 쪽보다 전면 차단이 안전하다.
  it('허용 목록이 비어 있으면 전부 막는다', () => {
    expect(isAllowedEmail('hong@eland.co.kr', [])).toBe(false);
  });

  it('허용 목록이 여러 개면 그중 하나만 맞아도 통과한다', () => {
    const many = ['eland.co.kr', 'elandmall.com'];
    expect(isAllowedEmail('hong@elandmall.com', many)).toBe(true);
    expect(isAllowedEmail('hong@nowhere.com', many)).toBe(false);
  });

  // 'a@b@eland.co.kr' 처럼 @ 가 여러 번이면 마지막 @ 뒤가 도메인이다.
  it('@ 가 여러 개면 마지막 @ 뒤를 도메인으로 본다', () => {
    expect(isAllowedEmail('a@b@eland.co.kr', allowed)).toBe(true);
    expect(isAllowedEmail('a@eland.co.kr@evil.com', allowed)).toBe(false);
  });
});
