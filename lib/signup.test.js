import { describe, it, expect } from 'vitest';
import { isAllowedEmail, JOB_ROLES } from './signup';

describe('JOB_ROLES', () => {
  // 이 테스트가 잡는 사고: 목록을 늘리면서 마이그레이션을 잊는 것.
  // job_role 에는 DB CHECK 제약이 걸려 있어서, 화면에만 값을 추가하면
  // 그 직무로 가입할 때 23514 로 막힌다. 실패는 가입 버튼을 누른 사람에게만
  // 보이므로, 목록을 바꿀 때 이 테스트가 함께 깨지게 두어 짝을 강제한다.
  //
  // 목록을 바꿨다면 supabase/migrations 에 CHECK 갱신 마이그레이션도 있어야 한다.
  it('직무 목록은 화면·API·DB 제약이 같은 값을 쓴다', () => {
    expect(JOB_ROLES).toEqual([
      '온라인 MD',
      '마케팅',
      'CS',
      '기획자',
      '디자이너',
      '개발자',
      '데이터 분석',
      '기타',
    ]);
  });

  it('기타는 마지막이다', () => {
    expect(JOB_ROLES[JOB_ROLES.length - 1]).toBe('기타');
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
