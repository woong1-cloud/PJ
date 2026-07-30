import { describe, it, expect } from 'vitest';
import { normalizeUrl } from './links';

describe('normalizeUrl', () => {
  it('https 주소를 그대로 받는다', () => {
    expect(normalizeUrl('https://figma.com/file/abc')).toBe('https://figma.com/file/abc');
  });

  it('http 주소를 그대로 받는다', () => {
    expect(normalizeUrl('http://internal.example.com/ga4')).toBe('http://internal.example.com/ga4');
  });

  it('스킴이 없으면 https 를 붙인다', () => {
    expect(normalizeUrl('figma.com/file/abc')).toBe('https://figma.com/file/abc');
  });

  it('앞뒤 공백을 떼고 판단한다', () => {
    expect(normalizeUrl('  https://figma.com/x  ')).toBe('https://figma.com/x');
  });

  it('쿼리와 프래그먼트를 잃지 않는다', () => {
    expect(normalizeUrl('https://ga.example.com/r?id=7#top')).toBe(
      'https://ga.example.com/r?id=7#top',
    );
  });

  // 저장된 값은 <a href> 로 그대로 들어간다. javascript: 가 통과하면
  // 링크를 누른 사람의 세션에서 스크립트가 실행된다. 스킴은 허용 목록으로
  // 막는다 — 금지 목록은 새 스킴이 생길 때마다 뚫린다.
  it('javascript: 를 막는다', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBe(null);
  });

  it('대문자·공백으로 위장한 javascript: 도 막는다', () => {
    expect(normalizeUrl('JaVaScRiPt:alert(1)')).toBe(null);
    expect(normalizeUrl('  javascript:alert(1)')).toBe(null);
  });

  it('data: 를 막는다', () => {
    expect(normalizeUrl('data:text/html,<script>alert(1)</script>')).toBe(null);
  });

  it('http/https 가 아닌 다른 스킴도 막는다', () => {
    expect(normalizeUrl('file:///etc/passwd')).toBe(null);
    expect(normalizeUrl('vbscript:msgbox(1)')).toBe(null);
    expect(normalizeUrl('ftp://example.com/x')).toBe(null);
  });

  it('빈 문자열과 공백만 있는 값은 막는다', () => {
    expect(normalizeUrl('')).toBe(null);
    expect(normalizeUrl('   ')).toBe(null);
  });

  it('문자열이 아닌 값은 막는다', () => {
    expect(normalizeUrl(null)).toBe(null);
    expect(normalizeUrl(undefined)).toBe(null);
    expect(normalizeUrl(123)).toBe(null);
  });

  it('주소로 볼 수 없는 값은 막는다', () => {
    expect(normalizeUrl('https://')).toBe(null);
    expect(normalizeUrl('그냥 메모')).toBe(null);
  });
});
