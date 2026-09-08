import { describe, expect, it } from 'vitest';
import { taskByCode } from './launchTaskLink';

const tasks = [
  { id: 'a', code: '18-22', title: '물류 창고 계약' },
  { id: 'b', code: '18-12', title: '인프라 설계' },
];

describe('taskByCode', () => {
  it('있는 코드를 찾는다', () => {
    expect(taskByCode({ tasks, code: '18-22' })).toEqual({
      task: tasks[0], missing: '',
    });
  });

  it('없는 코드는 missing 으로 돌려준다 — 조용히 넘기면 링크를 누른 사람이 아무것도 못 본다', () => {
    expect(taskByCode({ tasks, code: '99-99' })).toEqual({
      task: null, missing: '99-99',
    });
  });

  it('빈 코드는 창도 안 열고 안내도 안 띄운다', () => {
    expect(taskByCode({ tasks, code: '' })).toEqual({ task: null, missing: '' });
    expect(taskByCode({ tasks })).toEqual({ task: null, missing: '' });
  });

  it('공백만 있는 코드도 빈 것으로 친다', () => {
    expect(taskByCode({ tasks, code: '   ' })).toEqual({ task: null, missing: '' });
  });

  it('앞뒤 공백은 떼고 찾는다 — 주소를 손으로 붙이다 섞인다', () => {
    expect(taskByCode({ tasks, code: ' 18-12 ' }).task).toBe(tasks[1]);
  });

  it('목록이 비어 있어도 안 터진다 — 항목을 받기 전에 그려지는 순간이 있다', () => {
    expect(taskByCode({ tasks: [], code: '18-22' })).toEqual({
      task: null, missing: '18-22',
    });
    expect(taskByCode({})).toEqual({ task: null, missing: '' });
  });
});
