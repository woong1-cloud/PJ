'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { buildActivityFeed } from '@/lib/activityFeed';
import { canModifyComment } from '@/lib/comments';
import { CommentComposer, CommentEntry } from '@/components/comments/CommentPieces';

// 런칭 항목의 활동.
//
// 이력이 없다. 요구사항엔 change_logs 가 있지만 런칭엔 updated_by 한 칸뿐이라
// 「기록」 탭을 만들 재료가 없다 — 지라는 전체/댓글/기록/업무 로그로 가르지만
// 빈 탭은 고장으로 보인다. 그래서 탭도 없다.
//
// 순서는 오래된 것 위, 새 것 아래. 요구사항 활동과 같다
// (lib/activityFeed.js: "정렬은 오래된 것이 위, 새 것이 아래다").
// 지라는 반대(최신 먼저·입력 위)인데 모아 안의 일관성이 먼저다.
//
// 이미지는 안 받는다. CommentEntry 에 onDeleteImage 를, CommentComposer 에
// imageTypes/maxImages 를 안 넘기면 첨부 UI 가 안 그려진다 — 부품이 그렇게
// 만들어져 있다(components/comments/CommentPieces.jsx).
//
// 목록과 입력칸이 창의 서로 다른 자리에 놓인다(목록은 몸통 맨 아래, 입력칸은
// 발). 상세가 *페이지*인 요구사항과 달리 창은 높이가 갇혀 있어서, 입력칸이
// 목록 끝에 붙으면 댓글 열두 건을 지나 스크롤해야 답을 쓴다. 그래서 한
// 컴포넌트가 두 자리에 나뉘어 그려져야 하는데, 부품을 두 번 마운트하면 상태도
// 조회도 두 벌이 된다. 문맥으로 감싸 상태는 하나만 두고 그리는 자리만 나눈다 —
// Provider 는 DOM 을 만들지 않으므로 창의 flex 뼈대(머리·몸통·발)를 건드리지
// 않는다.
//
// props: launchId, taskId, memberId
const TaskActivityContext = createContext(null);

export function TaskActivity({ launchId, taskId, memberId, children }) {
  const [comments, setComments] = useState([]);
  // 쓰기(등록·수정·삭제) 실패와 읽기 실패를 나눠 든다. 둘을 한 칸에 담으면
  // 목록을 못 불러온 상태에서 등록에 실패했을 때 앞의 것이 지워진다.
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  // @로 부를 수 있는 사람들. 이 런칭의 참여자만 온다 — 서버가 알림을 보낼 때
  // 같은 목록으로 다시 판정한다.
  const [mentionable, setMentionable] = useState([]);

  const load = useCallback(() => {
    if (!launchId || !taskId) return;
    fetch(`/api/launch/${launchId}/tasks/${taskId}/comments`)
      .then((res) => res.json().then((d) => ({ res, d })))
      .then(({ res, d }) => {
        if (!res.ok) throw new Error(d.error ?? '활동을 불러오지 못했습니다.');
        setComments(d.comments ?? []);
        setLoadError('');
      })
      .catch((e) => {
        // 표가 아직 없으면(0036 미적용) 여기로 온다. 목록만 비우고 창은
        // 그대로 둔다 — 연계를 보러 온 사람까지 막을 이유가 없다.
        setComments([]);
        setLoadError(e.message);
      });
  }, [launchId, taskId]);

  // taskId 가 deps 에 있어야 한다(load 가 그것으로 만들어진다). 창 안에서
  // 연계를 타면 같은 컴포넌트가 다른 항목을 보게 되는데, 다시 안 받으면
  // 18-22 를 열어놓고 18-12 의 댓글을 읽게 된다.
  useEffect(() => {
    load();
  }, [load]);

  // 목록을 못 받아도 댓글은 쓸 수 있어야 한다. 자동완성은 편의이고, 실패를
  // 배너로 띄우면 "댓글이 안 되나?"로 읽힌다. 조용히 비운다.
  useEffect(() => {
    if (!launchId) return undefined;
    let cancelled = false;
    fetch(`/api/launch/${launchId}/mentionable`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!cancelled && d) setMentionable(d.members ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [launchId]);

  // 이력이 없으니 첫 인자는 늘 빈 배열이다. 그래도 buildActivityFeed 를 쓰는
  // 이유는 정렬 규칙(오래된 것 위, 깨진 시각은 맨 뒤)을 요구사항과 한 곳에서
  // 지키기 위해서다.
  const feed = useMemo(() => buildActivityFeed([], comments), [comments]);

  async function addComment(body) {
    setError('');
    const res = await fetch(`/api/launch/${launchId}/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? '댓글 등록 실패');
      // false 를 돌리면 입력칸이 그대로 남는다. 방금 쓴 말을 잃지 않는다.
      return false;
    }
    load();
    return true;
  }

  async function editComment(commentId, body) {
    setError('');
    const res = await fetch(`/api/launch/${launchId}/tasks/${taskId}/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? '댓글 수정 실패');
      return false;
    }
    load();
    return true;
  }

  async function deleteComment(commentId) {
    // 댓글은 그 사람이 쓴 말이다. 잘못 누른 클릭 한 번으로 지워지면 안 되고,
    // 되돌릴 방법도 없다(휴지통이 없다).
    if (!window.confirm('댓글을 삭제하시겠습니까? 되돌릴 수 없습니다.')) return;
    setError('');
    const res = await fetch(`/api/launch/${launchId}/tasks/${taskId}/comments/${commentId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? '댓글 삭제 실패');
      return;
    }
    load();
  }

  const value = useMemo(
    () => ({ feed, mentionable, memberId, error, loadError, addComment, editComment, deleteComment }),
    // addComment 등은 매 렌더 새로 만들어지지만 아래 두 부품만 쓰는 값이라
    // 그 자체가 문제되지 않는다. 참조가 바뀌는 것을 deps 로 못 박아 둔다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [feed, mentionable, memberId, error, loadError],
  );

  return <TaskActivityContext.Provider value={value}>{children}</TaskActivityContext.Provider>;
}

// 목록. 창 몸통 맨 아래에 놓인다.
export function TaskActivityList() {
  const ctx = useContext(TaskActivityContext);
  if (!ctx) return null;
  const { feed, mentionable, memberId, loadError, editComment, deleteComment } = ctx;

  return (
    <section className="mt-3 border-t border-slate-100 pt-3">
      <p className="mb-2 text-[11px] text-slate-500">
        활동{feed.length > 0 && <span className="ml-1 tabular-nums">{feed.length}</span>}
      </p>
      {/* 읽기 실패는 조용히 한 줄로만 말한다. 여기서 붉은 배너를 띄우면
          연계를 보러 온 사람에게 창이 고장난 것처럼 보인다. */}
      {loadError && <p className="text-[12.5px] text-slate-400">{loadError}</p>}
      {!loadError && feed.length === 0 && (
        <p className="text-[12.5px] text-slate-400">아직 아무 말도 없습니다.</p>
      )}
      <ul className="flex flex-col gap-2 text-[13px] text-slate-700">
        {feed.map((entry) => (
          <CommentEntry
            key={entry.id}
            comment={entry.data}
            mentionable={mentionable}
            // 서버도 같은 판정을 한다(작성자 본인만). 여기서 버튼을 감추는 것은
            // 편의일 뿐 권한 검사가 아니다.
            mine={canModifyComment(entry.data, memberId)}
            onEdit={(body) => editComment(entry.data.id, body)}
            onDelete={() => deleteComment(entry.data.id)}
            // onDeleteImage 를 안 넘긴다 — 런칭 댓글은 이미지를 안 받는다.
          />
        ))}
      </ul>
    </section>
  );
}

// 입력칸. 창의 발에 놓인다.
//
// 쓰기 실패 배너도 여기에 둔다. 발은 늘 보이지만 목록은 스크롤 밖으로
// 나가 있을 수 있어서, 목록 쪽에 두면 "눌렀는데 아무 일도 안 일어났다"가 된다.
export function TaskActivityComposer() {
  const ctx = useContext(TaskActivityContext);
  if (!ctx) return null;
  const { mentionable, error, addComment } = ctx;

  return (
    // CommentComposer 의 form 은 위에 제 구분선(mt-3 border-t pt-3)을 갖는다.
    // 요구사항 상세에서는 목록과 입력칸 사이를 가르는 선이지만, 여기서는
    // 발이 이미 border-t 로 갈라져 있어 선이 두 겹으로 보이고 갇힌 높이를
    // 12px 씩 먹는다. 부품을 고치면 요구사항 화면이 바뀌므로 부르는 쪽에서 끈다.
    <div className="w-full [&>form]:mt-0 [&>form]:border-t-0 [&>form]:pt-0">
      {error && <p className="mb-2 text-[12.5px] text-red-600">{error}</p>}
      {/* imageTypes·maxImages 를 안 넘긴다 — 첨부 UI 가 안 그려진다. */}
      <CommentComposer
        onSubmit={addComment}
        mentionable={mentionable}
        placeholder="무엇이 막고 있는지, 언제 풀릴지 적어 주세요. @로 참여자를 부를 수 있습니다."
      />
    </div>
  );
}
