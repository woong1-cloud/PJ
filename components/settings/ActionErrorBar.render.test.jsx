import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';

import { ActionErrorBar } from './ActionErrorBar';

// 왜 렌더 테스트를 두는지는 TopBar.render.test.jsx 의 첫 주석에 있다.

describe('ActionErrorBar', () => {
  it('문구가 있으면 경고로 그린다', () => {
    const html = renderToString(
      <ActionErrorBar message="마지막 브랜드 관리자는 강등할 수 없습니다." onClose={() => {}} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('마지막 브랜드 관리자는 강등할 수 없습니다.');
    // 스크롤과 상관없이 보여야 하는 것이 이 부품의 존재 이유다.
    expect(html).toContain('fixed');
  });

  it('문구가 비면 아무것도 안 그린다', () => {
    expect(renderToString(<ActionErrorBar message="" onClose={() => {}} />)).toBe('');
    expect(renderToString(<ActionErrorBar onClose={() => {}} />)).toBe('');
  });
});
