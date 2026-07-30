import { describe, it, expect } from 'vitest';
import {
  NOTIFICATION_LIMIT,
  assigneeMessage,
  commentMessage,
  commentRecipients,
  mentionMessage,
  relativeTime,
  resolveRecipients,
  roParticle,
  statusMessage,
  truncateTitle,
} from './notifications';

describe('resolveRecipients', () => {
  it('요청자와 담당자 둘 다 받는다', () => {
    expect(resolveRecipients({ requester: 'req', assignee: 'asg' }, 'actor')).toEqual([
      'req',
      'asg',
    ]);
  });

  // 이 한 줄이 벨의 신뢰도를 결정한다. 내 요구사항에 내가 코멘트를 달고
  // 알림이 오면, 사람들은 하루 만에 벨을 안 보게 된다.
  it('행동한 본인은 절대 받지 않는다', () => {
    expect(resolveRecipients({ requester: 'me', assignee: 'asg' }, 'me')).toEqual(['asg']);
    expect(resolveRecipients({ requester: 'req', assignee: 'me' }, 'me')).toEqual(['req']);
    expect(resolveRecipients({ requester: 'me', assignee: 'me' }, 'me')).toEqual([]);
  });

  // 요청자이면서 담당자인 사람은 한 사건에 알림 하나만 받아야 한다.
  it('요청자와 담당자가 같은 사람이면 하나로 합친다', () => {
    expect(resolveRecipients({ requester: 'same', assignee: 'same' }, 'actor')).toEqual(['same']);
  });

  it('비어 있는 자리는 건너뛴다', () => {
    expect(resolveRecipients({ requester: 'req', assignee: null }, 'actor')).toEqual(['req']);
    expect(resolveRecipients({ requester: null, assignee: 'asg' }, 'actor')).toEqual(['asg']);
    expect(resolveRecipients({ requester: null, assignee: null }, 'actor')).toEqual([]);
    expect(resolveRecipients({}, 'actor')).toEqual([]);
    expect(resolveRecipients(null, 'actor')).toEqual([]);
  });

  // 서버는 컬럼(uuid 문자열)을 읽지만 조회에 embed 를 걸면 {id, name} 이 온다.
  // 한쪽 모양만 알면 다른 쪽에서 조용히 엉뚱한 값이 들어간다.
  it('embed 된 {id, name} 모양도 받아들인다', () => {
    expect(
      resolveRecipients({ requester: { id: 'req', name: '김요청' }, assignee: { id: 'asg' } }, 'x')
    ).toEqual(['req', 'asg']);
    expect(resolveRecipients({ requester: { id: 'me' }, assignee: 'asg' }, 'me')).toEqual(['asg']);
  });

  // actorId 가 없으면 "본인 제외"를 적용할 수 없다. 그 상태로 전부에게
  // 보내면 본인에게 갈 수 있으므로, 차라리 아무에게도 보내지 않는다.
  it('행위자를 모르면 아무에게도 보내지 않는다', () => {
    expect(resolveRecipients({ requester: 'req', assignee: 'asg' }, null)).toEqual([]);
    expect(resolveRecipients({ requester: 'req', assignee: 'asg' }, undefined)).toEqual([]);
    expect(resolveRecipients({ requester: 'req', assignee: 'asg' }, '')).toEqual([]);
  });
});

// 코멘트 하나가 만드는 알림 목록. 요청자·담당자에 더해 본문에서 불린 사람이
// 들어온다. 멘션의 요점이 바로 이것 — 요청자도 담당자도 아닌 사람을 부를 수
// 있어야 부르는 의미가 있다.
describe('commentRecipients', () => {
  it('요청자·담당자에 불린 사람을 더한다', () => {
    expect(commentRecipients({ requester: 'req', assignee: 'asg' }, 'actor', ['men'])).toEqual([
      { id: 'req', mentioned: false },
      { id: 'asg', mentioned: false },
      { id: 'men', mentioned: true },
    ]);
  });

  // 멘션이 없으면 지금까지와 똑같이 동작해야 한다.
  it('부른 사람이 없으면 기존 수신자 그대로다', () => {
    expect(commentRecipients({ requester: 'req', assignee: 'asg' }, 'actor')).toEqual([
      { id: 'req', mentioned: false },
      { id: 'asg', mentioned: false },
    ]);
  });

  // 한 코멘트로 벨이 두 번 울리면 안 된다. 담당자를 부른 경우가 흔하다.
  it('이미 받을 사람을 불러도 알림은 하나다', () => {
    expect(commentRecipients({ requester: 'req', assignee: 'asg' }, 'actor', ['asg'])).toEqual([
      { id: 'req', mentioned: false },
      { id: 'asg', mentioned: true },
    ]);
  });

  it('같은 사람을 여러 번 불러도 하나로 합친다', () => {
    expect(commentRecipients({ requester: null, assignee: null }, 'actor', ['men', 'men'])).toEqual([
      { id: 'men', mentioned: true },
    ]);
  });

  // 본인을 부르는 일은 실제로 잦다(팀 전체를 나열하다가). 그때 나에게 알림이
  // 오면 벨은 하루 만에 장식이 된다.
  it('자기 자신을 불러도 자기에게는 안 간다', () => {
    expect(commentRecipients({ requester: 'req', assignee: null }, 'me', ['me'])).toEqual([
      { id: 'req', mentioned: false },
    ]);
    expect(commentRecipients({ requester: 'me', assignee: 'me' }, 'me', ['me'])).toEqual([]);
  });

  it('행위자를 모르면 아무에게도 보내지 않는다', () => {
    expect(commentRecipients({ requester: 'req' }, null, ['men'])).toEqual([]);
  });

  it('빈 값과 이상한 인자를 흘려보낸다', () => {
    expect(commentRecipients({ requester: 'req' }, 'actor', [null, ''])).toEqual([
      { id: 'req', mentioned: false },
    ]);
    expect(commentRecipients({ requester: 'req' }, 'actor', null)).toEqual([
      { id: 'req', mentioned: false },
    ]);
  });
});

describe('roParticle', () => {
  it('받침이 없으면 로', () => {
    expect(roParticle('대기')).toBe('로');
    expect(roParticle('검토')).toBe('로');
    expect(roParticle('완료')).toBe('로');
    expect(roParticle('취소')).toBe('로');
  });

  it('받침이 있으면 으로', () => {
    expect(roParticle('요청')).toBe('으로');
    expect(roParticle('진행중')).toBe('으로');
    expect(roParticle('중복')).toBe('으로');
  });

  // ㄹ 받침은 예외다 — '정책정의로'가 아니라 'ㄹ' 뒤에는 '로'가 붙는다.
  it('ㄹ 받침은 로', () => {
    expect(roParticle('설')).toBe('로');
  });

  it('한글이 아니거나 비어 있으면 로', () => {
    expect(roParticle('done')).toBe('로');
    expect(roParticle('')).toBe('로');
    expect(roParticle(null)).toBe('로');
  });
});

describe('truncateTitle', () => {
  it('짧은 제목은 그대로 둔다', () => {
    expect(truncateTitle('결제 버튼 색상 변경')).toBe('결제 버튼 색상 변경');
  });

  it('긴 제목은 잘라내고 말줄임표를 붙인다', () => {
    const long = '가'.repeat(60);
    const result = truncateTitle(long);
    expect(result.length).toBeLessThanOrEqual(41);
    expect(result.endsWith('…')).toBe(true);
  });

  it('제목이 없으면 빈 문자열', () => {
    expect(truncateTitle(null)).toBe('');
    expect(truncateTitle(undefined)).toBe('');
  });
});

describe('메시지 문구', () => {
  it('코멘트 알림', () => {
    expect(commentMessage('김관리', '결제 페이지 버튼 색상 변경')).toBe(
      "김관리님이 '결제 페이지 버튼 색상 변경'에 코멘트를 남겼습니다"
    );
  });

  // 불려서 온 알림과 그냥 코멘트 알림은 눌러야 할 이유가 다르다. 벨에서
  // 구분이 안 되면 "나를 부른 그 코멘트"를 찾으러 매번 들어가 봐야 한다.
  it('멘션 알림은 코멘트 알림과 문구가 다르다', () => {
    expect(mentionMessage('김관리', '결제 버튼')).toBe(
      "김관리님이 '결제 버튼' 코멘트에서 회원님을 언급했습니다"
    );
    expect(mentionMessage(null, '결제 버튼')).toBe(
      "누군가 '결제 버튼' 코멘트에서 회원님을 언급했습니다"
    );
  });

  it('상태 변경 알림은 조사를 가려 붙인다', () => {
    expect(statusMessage('김관리', '결제 버튼', '진행중')).toBe(
      "김관리님이 '결제 버튼' 상태를 '진행중'으로 바꿨습니다"
    );
    expect(statusMessage('김관리', '결제 버튼', '완료')).toBe(
      "김관리님이 '결제 버튼' 상태를 '완료'로 바꿨습니다"
    );
  });

  it('담당자 지정 알림', () => {
    expect(assigneeMessage('김관리', '결제 버튼', '이담당')).toBe(
      "김관리님이 '결제 버튼' 담당자를 이담당님으로 지정했습니다"
    );
  });

  // 이름을 못 찾아도 문장이 "님이 ..." 로 시작하면 안 된다.
  it('이름을 모르면 대체 표현을 쓴다', () => {
    expect(commentMessage(null, '결제 버튼')).toBe("누군가 '결제 버튼'에 코멘트를 남겼습니다");
    expect(assigneeMessage('김관리', '결제 버튼', null)).toBe(
      "김관리님이 '결제 버튼' 담당자를 지정했습니다"
    );
  });

  it('메시지 안의 제목도 잘린다', () => {
    const long = '가'.repeat(60);
    expect(commentMessage('김관리', long)).toContain('…');
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-07-29T12:00:00Z');

  it('1분 미만은 방금', () => {
    expect(relativeTime('2026-07-29T11:59:30Z', now)).toBe('방금');
  });

  it('분 단위', () => {
    expect(relativeTime('2026-07-29T11:45:00Z', now)).toBe('15분 전');
  });

  it('시간 단위', () => {
    expect(relativeTime('2026-07-29T09:00:00Z', now)).toBe('3시간 전');
  });

  it('일 단위', () => {
    expect(relativeTime('2026-07-27T12:00:00Z', now)).toBe('2일 전');
  });

  it('일주일이 넘으면 날짜로 보여준다', () => {
    expect(relativeTime('2026-07-01T12:00:00Z', now)).toBe('7월 1일');
  });

  // 서버·클라이언트 시계가 조금 어긋나 미래 시각이 와도 "-3분 전"이 되면 안 된다.
  it('미래 시각은 방금으로 본다', () => {
    expect(relativeTime('2026-07-29T12:00:30Z', now)).toBe('방금');
  });

  it('값이 없으면 빈 문자열', () => {
    expect(relativeTime(null, now)).toBe('');
    expect(relativeTime('말도 안 되는 값', now)).toBe('');
  });
});

describe('NOTIFICATION_LIMIT', () => {
  // 드롭다운은 좁다. 무한정 내려받아 봐야 아무도 끝까지 안 본다.
  it('한 번에 내려주는 개수에 상한이 있다', () => {
    expect(NOTIFICATION_LIMIT).toBeGreaterThan(0);
    expect(NOTIFICATION_LIMIT).toBeLessThanOrEqual(50);
  });
});
