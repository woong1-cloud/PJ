import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// 설치 조건을 못 박는다.
//
// 하나라도 빠지면 브라우저가 **아무 말 없이** 설치 단추를 안 띄운다.
// 오류도 경고도 없다. 그래서 사람이 아니라 테스트가 지킨다.
//
// 스펙: docs/superpowers/specs/2026-09-09-pwa-install-design.md §3

const ROOT = process.cwd();
const manifest = JSON.parse(readFileSync(join(ROOT, 'public', 'manifest.json'), 'utf8'));

describe('manifest.json', () => {
  it('이름 둘을 갖는다 — short_name 이 홈 화면 아래 붙는다', () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
  });

  it('창으로 뜬다', () => {
    expect(manifest.display).toBe('standalone');
  });

  // 루트는 미들웨어가 무조건 /login 으로 보낸다. 앱을 열 때마다 로그인
  // 화면을 지나가지 않도록 일하는 화면에서 시작한다.
  it('/launch 에서 시작한다 — 루트가 아니다', () => {
    expect(manifest.start_url).toBe('/launch');
  });

  it('192 와 512 아이콘이 있다 — 설치 조건이다', () => {
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  it('maskable 이 하나 있다 — 안드로이드가 모양대로 깎는다', () => {
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });

  // 매니페스트에 적힌 그림이 실제로 있어야 한다. 파일명을 고치고 매니페스트를
  // 안 고치면 여기서 걸린다.
  it('적힌 아이콘 파일이 전부 실제로 있다', () => {
    for (const icon of manifest.icons) {
      expect(existsSync(join(ROOT, 'public', icon.src)), icon.src).toBe(true);
    }
  });
});
