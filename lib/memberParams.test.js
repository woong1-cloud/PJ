import { describe, expect, it } from 'vitest';
import { DEFAULT_MEMBER_FILTER, mergeMemberParams, parseMemberParams } from './memberParams';

const sp = (search) => new URLSearchParams(search);

describe('parseMemberParams', () => {
  it('아무것도 없으면 기본값', () => {
    expect(parseMemberParams(sp(''))).toEqual({ q: '', f: 'all', brand: '' });
  });

  it('searchParams 가 없어도 안 죽는다', () => {
    expect(parseMemberParams(undefined)).toEqual({ q: '', f: 'all', brand: '' });
  });

  it('주소에 든 값을 그대로 읽는다', () => {
    expect(parseMemberParams(sp('q=한지&f=active&brand=s')))
      .toEqual({ q: '한지', f: 'active', brand: 's' });
  });

  // 손으로 주소를 고쳤거나 링크가 잘려 온 사람에게 빈 화면 대신 기본 화면을
  // 준다. lib/launchFilters.js 가 하는 것과 같다.
  it('모르는 f 는 기본값으로 떨어진다', () => {
    expect(parseMemberParams(sp('f=엉뚱한값')).f).toBe('all');
    expect(parseMemberParams(sp('f=')).f).toBe('all');
  });

  it('빈 q 는 빈 문자열', () => {
    expect(parseMemberParams(sp('q=')).q).toBe('');
  });

  it('q 의 앞뒤 공백은 떼어낸다', () => {
    expect(parseMemberParams(sp('q=%20%20한지%20%20')).q).toBe('한지');
  });

  // 브랜드는 uuid 라 목록을 미리 못 갖는다. 열거형으로 막지 않고 그대로 받되,
  // 없는 브랜드면 목록이 비어 보일 뿐 화면은 안 죽는다.
  it('brand=none 은 그대로 통과한다 — 배치 없음도 하나의 선택이다', () => {
    expect(parseMemberParams(sp('brand=none')).brand).toBe('none');
  });

  it('브랜드 id 를 그대로 통과시킨다', () => {
    expect(parseMemberParams(sp('brand=0a1b-uuid')).brand).toBe('0a1b-uuid');
  });

  it('DEFAULT_MEMBER_FILTER 가 기본 칩이다', () => {
    expect(DEFAULT_MEMBER_FILTER).toBe('all');
  });
});

describe('mergeMemberParams', () => {
  it('변경분만 얹는다', () => {
    expect(mergeMemberParams('f=active', { brand: 's' })).toBe('f=active&brand=s');
  });

  // 기본값을 주소에 남기면 "?" 가 붙어 있는 것이 필터가 걸렸다는 신호가
  // 되지 못한다. 남에게 보낼 때도 뜻이 흐려진다.
  it('기본 칩으로 되돌리면 키를 지운다', () => {
    expect(mergeMemberParams('f=active&brand=s', { f: 'all' })).toBe('brand=s');
  });

  it('모르는 f 도 기본값과 같이 지운다', () => {
    expect(mergeMemberParams('f=active', { f: '엉뚱한값' })).toBe('');
  });

  it('빈 문자열·null·undefined·false 는 키를 지운다', () => {
    expect(mergeMemberParams('q=한지&brand=s', { q: '' })).toBe('brand=s');
    expect(mergeMemberParams('brand=s', { brand: null })).toBe('');
    expect(mergeMemberParams('brand=s', { brand: undefined })).toBe('');
    expect(mergeMemberParams('brand=s', { brand: false })).toBe('');
  });

  it('공백뿐인 q 는 안 남긴다', () => {
    expect(mergeMemberParams('q=한지', { q: '   ' })).toBe('');
  });

  it('q 의 앞뒤 공백을 떼고 넣는다', () => {
    expect(mergeMemberParams('', { q: '  한지  ' })).toBe('q=%ED%95%9C%EC%A7%80');
  });

  it('brand=none 은 남긴다 — 기본값이 아니다', () => {
    expect(mergeMemberParams('', { brand: 'none' })).toBe('brand=none');
  });

  // 필터와 무관한 파라미터는 안 건드린다. 다른 화면이 얹어 둔 것을 여기서
  // 지우면 되돌아갈 때 그 화면이 초기화된다.
  it('모르는 파라미터는 그대로 둔다', () => {
    expect(mergeMemberParams('tab=members&f=active', { q: '한' }))
      .toBe('tab=members&f=active&q=%ED%95%9C');
  });

  it('빈 주소에서 시작해도 된다', () => {
    expect(mergeMemberParams(undefined, { f: 'off' })).toBe('f=off');
  });
});
