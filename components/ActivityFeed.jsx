'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildActivityFeed } from '@/lib/activityFeed';
import { canModifyComment } from '@/lib/comments';
import { ALLOWED_IMAGE_TYPES, MAX_ATTACHMENTS_PER_COMMENT } from '@/lib/imageUpload';
// 코멘트 부품은 공용이다(components/comments). 요구사항만의 것은 여기 남는다 —
// 탭, 이력 줄, 그리고 /api/requirements/... 를 아는 fetch 들.
import { Avatar, CommentComposer, CommentEntry, fmt } from '@/components/comments/CommentPieces';

// 활동 — 상태 변경 이력과 코멘트를 한 줄기로 보여준다.
//
// 두 출처를 따로 놓지 않는 것이 이 화면의 요점이다. "왜 이 상태로 갔는지"(이력)와
// "그때 무슨 얘기가 오갔는지"(코멘트)는 원래 한 흐름인데, 상자를 나눠 놓으면
// 읽는 사람이 두 목록의 시각을 눈으로 짜맞춰야 한다.
//
// 저장은 여전히 따로다. 이력은 감사 기록이라 못 고치고, 코멘트는 고칠 수 있다.
// 섞는 일은 읽을 때만 일어난다(lib/activityFeed.js).
//
// props: requirementId, brandId, history(상세 API 의 change_logs), memberId(보는 사람)
export function ActivityFeed({ requirementId, brandId, history, memberId }) {
  const [comments, setComments] = useState([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('comment');
  // @로 부를 수 있는 사람들. 이 건의 브랜드 팀만 온다 — 열지도 못하는 사람을
  // 부르면 알림을 받고 눌러도 403 이 뜬다(서버가 같은 목록으로 다시 판정한다).
  const [mentionable, setMentionable] = useState([]);

  const load = useCallback(() => {
    // brandId 는 상세를 불러온 뒤에야 정해진다. 그 전에 요청하면 엉뚱한
    // 브랜드로 물어보게 되어 403 이 한 번 깜빡인다.
    if (!requirementId || !brandId) return;
    fetch(`/api/requirements/${requirementId}/comments?brandId=${brandId}`)
      .then((res) => res.json().then((d) => ({ res, d })))
      .then(({ res, d }) => {
        if (!res.ok) throw new Error(d.error ?? '코멘트를 불러오지 못했습니다.');
        setComments(d.comments ?? []);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, [requirementId, brandId]);

  useEffect(() => {
    load();
  }, [load]);

  // 목록을 못 받아도 코멘트는 쓸 수 있어야 한다. 자동완성은 편의이고, 실패를
  // 배너로 띄우면 "코멘트가 안 되나?"로 읽힌다. 조용히 비운다.
  useEffect(() => {
    if (!requirementId || !brandId) return undefined;
    let cancelled = false;
    fetch(`/api/requirements/${requirementId}/mentionable?brandId=${brandId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!cancelled && d) setMentionable(d.members ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [requirementId, brandId]);

  const feed = useMemo(() => buildActivityFeed(history, comments), [history, comments]);

  // 코멘트를 먼저 만들고, 그 id 로 시안을 올린다. 순서를 뒤집을 수 없다 —
  // 시안이 붙을 코멘트가 아직 없기 때문이다.
  //
  // 그래서 반쪽 실패가 있다. 코멘트는 올라갔는데 그림이 실패하는 경우다.
  // 그때 false 를 돌려 입력칸을 되돌리면 같은 말이 두 번 올라간다. true 를
  // 돌려 입력칸은 비우고, 무엇이 안 갔는지만 배너로 말한다.
  async function addComment(body, files = []) {
    setError('');
    const res = await fetch(`/api/requirements/${requirementId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, body }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? '코멘트 등록 실패');
      return false;
    }

    if (files.length > 0) {
      const { comment } = await res.json();
      const form = new FormData();
      form.append('brandId', brandId);
      form.append('commentId', comment.id);
      for (const file of files) form.append('files', file);
      const up = await fetch(`/api/requirements/${requirementId}/images`, {
        method: 'POST',
        body: form,
      });
      if (!up.ok) {
        const d = await up.json().catch(() => ({}));
        setError(
          `${d.error ?? '시안 업로드 실패'} — 코멘트는 등록됐습니다. 시안은 다시 올려 주세요.`,
        );
      }
    }

    load();
    return true;
  }

  // 코멘트에 붙은 시안 한 장 떼기. 서버도 같은 판정을 한다(코멘트 작성자만).
  async function deleteCommentImage(imageId) {
    if (!window.confirm('시안을 삭제하시겠습니까? 되돌릴 수 없습니다.')) return;
    setError('');
    const res = await fetch(
      `/api/requirements/${requirementId}/images/${imageId}?brandId=${brandId}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? '시안 삭제 실패');
      return;
    }
    load();
  }

  async function editComment(commentId, body) {
    setError('');
    const res = await fetch(`/api/requirements/${requirementId}/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, body }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? '코멘트 수정 실패');
      return false;
    }
    load();
    return true;
  }

  async function deleteComment(commentId) {
    // 코멘트는 그 사람이 쓴 말이다. 잘못 누른 클릭 한 번으로 지워지면 안 되고,
    // 되돌릴 방법도 없다(휴지통이 없다).
    if (!window.confirm('코멘트를 삭제하시겠습니까? 되돌릴 수 없습니다.')) return;
    setError('');
    const res = await fetch(
      `/api/requirements/${requirementId}/comments/${commentId}?brandId=${brandId}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? '코멘트 삭제 실패');
      return;
    }
    load();
  }

  // 기본은 코멘트만이다.
  //
  // 처음엔 이력과 코멘트를 한 줄기로 섞었는데, 상태 변경이 열댓 개 쌓인 건에서
  // 대화 두 줄을 찾으려면 스크롤을 훑어야 했다. 읽으러 오는 것(대화)과
  // 확인하러 오는 것(감사 기록)은 목적이 다르다. 섞어 보는 선택지는 남기되
  // 기본값은 대화로 둔다 — 맥락이 필요한 순간은 가끔이고, 대화를 읽으러
  // 오는 순간이 훨씬 잦다.
  const visible = tab === 'comment' ? feed.filter((e) => e.kind === 'comment') : feed;
  const commentCount = feed.filter((e) => e.kind === 'comment').length;

  return (
    // 카드를 벗긴다. 본문의 As-Is·To-Be·첨부가 전부 문서인데 대화만 상자
    // 안에 있으면 한 화면에 두 언어가 섞인다 — 연결·하위 작업에서 걷어낸
    // 것과 같은 문제가 여기 남아 있었다.
    <section className="border-t border-slate-200 pt-4">
      <div className="mb-3 flex items-center gap-1">
        <TabButton active={tab === 'comment'} onClick={() => setTab('comment')}>
          코멘트{commentCount > 0 && <span className="ml-1 text-slate-400">{commentCount}</span>}
        </TabButton>
        <TabButton active={tab === 'all'} onClick={() => setTab('all')}>
          전체 활동
        </TabButton>
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {visible.length === 0 && (
        <p className="text-sm text-slate-400">
          {tab === 'comment' ? '아직 코멘트가 없습니다.' : '기록이 없습니다.'}
        </p>
      )}
      <ul className="flex flex-col gap-2 text-sm text-slate-700">
        {visible.map((entry) =>
          entry.kind === 'comment' ? (
            <CommentEntry
              key={entry.id}
              comment={entry.data}
              mentionable={mentionable}
              // 서버도 같은 판정을 한다(작성자 본인만). 여기서 버튼을 감추는 것은
              // 편의일 뿐 권한 검사가 아니다.
              mine={canModifyComment(entry.data, memberId)}
              onEdit={(body) => editComment(entry.data.id, body)}
              onDelete={() => deleteComment(entry.data.id)}
              onDeleteImage={deleteCommentImage}
            />
          ) : (
            <ChangeEntry key={entry.id} log={entry.data} />
          ),
        )}
      </ul>
      {/* 시안 첨부는 요구사항 쪽 정책이라 여기서 넘긴다. 지금까지 부품 안에
          박혀 있던 것과 같은 상수다. 안내 문구도 같다 — 부품 안에 있던 문장을
          그대로 옮겼을 뿐이라 이 화면은 바뀌지 않는다. 런칭 항목 창이 자기
          문구를 넘길 수 있게 prop 으로 뺐다. */}
      <CommentComposer
        onSubmit={addComment}
        mentionable={mentionable}
        imageTypes={ALLOWED_IMAGE_TYPES}
        maxImages={MAX_ATTACHMENTS_PER_COMMENT}
        placeholder="이 요청에 대해 남길 말을 적어 주세요. @로 팀원을 부를 수 있습니다."
      />
    </section>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-3 py-1 text-sm transition-colors ${
        active ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}


// 상태 변경 등 감사 기록 한 줄. 기존 활동 목록의 문구를 그대로 옮겼다.
function ChangeEntry({ log: h }) {
  return (
    <li className="flex items-start gap-2">
      <Avatar name={h.changer?.name} tone="bg-slate-100 text-slate-500" />
      <span>
        {h.changer?.name ?? '누군가'}님이{' '}
        {h.change_type === '내용수정' || h.change_type === '중복병합' ? (
          h.comment
        ) : (
          <>
            {/* 변경 종류마다 문구가 다르다. 예전에는 모든 행에 상태변경
                문구를 붙여서 예상일 변경이 '상태를 null→2026-07-25로
                변경'으로 보였다. */}
            {h.change_type === '예상일변경'
              ? `배포예상일을 ${h.old_value ?? '미정'}→${h.new_value ?? '미정'}(으)로 변경`
              : h.change_type === '담당자지정'
                ? `담당자를 ${h.old_value ?? '없음'}→${h.new_value ?? '없음'}(으)로 변경`
                : `상태를 ${h.old_value}→${h.new_value}로 변경`}
            {/* 종결(반려·취소) 사유가 여기 들어온다. 사유를 필수로
                받아놓고 화면에 안 보여주면 저장한 의미가 없다. */}
            {h.comment && <span className="text-slate-600"> — {h.comment}</span>}
          </>
        )}
        <span className="text-slate-400"> · {fmt(h.created_at)}</span>
      </span>
    </li>
  );
}
