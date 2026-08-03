'use client';

import { useState } from 'react';
import { redmineLinkState, MAX_REDMINE_URL } from '@/lib/redmineLink';

// 실행 연결 — 이 요구사항이 레드마인의 어느 이슈로 넘어갔는지.
//
// MOA 와 레드마인의 층을 나누면서(접수·합의는 MOA, 실행은 레드마인) 인계
// 누락이라는 새 실패 지점이 생겼다. MOA 에는 개발중으로 남아 있는데 레드마인에
// 티켓이 없으면, 브랜드는 기다리고 실제로는 아무 일도 일어나지 않는다.
//
// 브랜드 담당자는 이 링크를 눌러도 레드마인 계정이 없어 못 볼 수 있다. 그래도
// "넘어갔다/안 넘어갔다"는 사실 자체가 정보다 — 진행 상황은 MOA 상태가 말한다.
//
// props: requirementId, brandId, requirement({status, redmine_url}), canEdit, onSaved
export function RedmineLinkSection({ requirementId, brandId, requirement, canEdit, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(requirement?.redmine_url ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const state = redmineLinkState(requirement);
  const current = requirement?.redmine_url ?? '';

  // 아직 넘길 단계가 아니고 링크도 없고 고칠 권한도 없으면 보여줄 것이 없다.
  if (state === 'none' && !current && !canEdit) return null;

  async function save(next) {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/requirements/${requirementId}/redmine`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, redmineUrl: next }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? '저장에 실패했습니다.');
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-1 border-t border-slate-200 pt-3">
      <p className="mb-2 text-xs text-slate-400">실행 연결</p>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(url);
          }}
          className="flex flex-col gap-2"
        >
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={MAX_REDMINE_URL}
            placeholder="https://redmine.../issues/1234"
            className="h-9 rounded-lg border border-slate-300 px-3 text-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="h-8 rounded-lg bg-indigo-600 px-3 text-sm text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              {submitting ? '저장 중...' : '저장'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setUrl(current);
                setError('');
              }}
              className="h-8 rounded-lg border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50"
            >
              취소
            </button>
            {/* 잘못 붙인 주소를 지울 길이 없으면 사람들은 틀린 채로 둔다. */}
            {current && (
              <button
                type="button"
                onClick={() => save('')}
                disabled={submitting}
                className="h-8 rounded-lg px-3 text-sm text-slate-400 hover:text-red-600"
              >
                연결 해제
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          {current ? (
            <a
              href={current}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 truncate text-sm text-indigo-600 hover:underline"
              title={current}
            >
              {current}
            </a>
          ) : state === 'missing' ? (
            <span className="flex-1 break-keep text-sm text-amber-700">
              아직 레드마인으로 넘어가지 않았습니다.
            </span>
          ) : (
            <span className="flex-1 text-sm text-slate-400">연결된 이슈 없음</span>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setUrl(current);
                setEditing(true);
              }}
              className="shrink-0 text-xs text-slate-500 underline hover:text-slate-700"
            >
              {current ? '변경' : '연결'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
