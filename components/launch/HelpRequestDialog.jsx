'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { splitRoles } from '@/lib/launchMembers';
import {
  MAX_RECIPIENTS, defaultRoles, recentlyAsked, recipientsForRoles, tooMany,
} from '@/lib/helpRequest';

// 협조 요청 창.
//
// 막힘을 걸어도 상대는 모른다. 471건에 담당자는 거의 없고 역할만 있어서
// @멘션으로는 부를 이름을 모른다 — 그 자리를 메우는 창이다.
//
// 자동으로 안 보낸다. lib/weeklyDigest.js 가 "방치된 건마다 리마인더를
// 보내면 지금 당장 25통이 나가고, 그러면 사람들이 규칙을 만들어 걸러
// 버린다"고 적어 둔 판단 때문이다. 사람이 눌러야 나간다.
//
// 요청의 본체는 댓글이다(launch_task_comments.request_roles). 그래서 보낸
// 뒤 활동에 한 줄로 남고, 다른 사람이 또 보내지 않는다.
//
// props: open, launchId, launchName, tasks(배열), members, myMemberId,
//        onClose, onSent({ sent, tasks })
//
// members 는 /api/launch/[id]/members 가 주는 launch_members 행이다
// (role_name + 조인된 member 객체). mentionable 라우트는 역할 없이
// { id, name } 만 주므로 역할별 사람 수를 못 센다 — 그래서 이 창은
// 보드가 이미 들고 있는 명단을 그대로 받는다.
export function HelpRequestDialog({
  open, launchId, launchName, tasks = [], members = [], myMemberId, onClose, onSent,
}) {
  // 보낼 항목. 여러 줄로 열었을 때 하나씩 뺄 수 있어야 한다 — 24시간 안에
  // 이미 나간 건을 보고 그것만 빼는 것이 이 체크의 쓸모다.
  const [picked, setPicked] = useState(
    () => new Set((tasks ?? []).map((t) => t?.id).filter(Boolean)),
  );
  // 미리 고른 역할. defaultRoles 가 막힘이면 결정권, 아니면 주관을 준다.
  const [roles, setRoles] = useState(() => uniq((tasks ?? []).flatMap((t) => defaultRoles(t))));
  const [message, setMessage] = useState('');
  // 24시간 안에 나간 요청. 창이 열릴 때 한 번만 받는다.
  const [recent, setRecent] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  // 보낸 뒤 화면. 서버가 돌려준 실제 발송 수를 여기 담는다.
  const [result, setResult] = useState(null);

  const many = (tasks ?? []).length > 1;
  const first = (tasks ?? [])[0] ?? null;

  // 조회에 쓸 id 들. 문자열로 굳혀 deps 에 넣는다 — 배열을 그대로 넣으면
  // 부모가 매 렌더 새 배열을 만들 때마다 다시 받는다.
  const idsKey = useMemo(
    () => (tasks ?? []).map((t) => t?.id).filter(Boolean).join(','),
    [tasks],
  );

  // 못 받아도 조용히 비운다. 이 경고는 편의이고, 실패를 배너로 띄우면
  // "요청이 안 되나?"로 읽힌다 — TaskActivity 의 mentionable 조회와 같다.
  useEffect(() => {
    if (!launchId || !idsKey) return undefined;
    let cancelled = false;
    fetch(`/api/launch/${launchId}/help-requests/recent?taskIds=${encodeURIComponent(idsKey)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!cancelled && d) setRecent(d.recent ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [launchId, idsKey]);

  // 역할 칩에 무엇을 깔까.
  //
  // 미리 고른 것 → 이 항목들이 적어 둔 역할(주관·지원·결정권) → 명단에만
  // 있는 역할 순이다. 사람이 0명인 역할도 남긴다 — 그 0 이 곧 "여기 아무도
  // 없다"는 말이고, 명단을 고치러 가는 단서다.
  const roleOptions = useMemo(() => {
    const fromTasks = (tasks ?? []).flatMap((t) => [
      ...defaultRoles(t),
      ...splitRoles(t?.owner_role),
      ...splitRoles(t?.support_role),
      ...splitRoles(t?.decision_org),
    ]);
    const fromMembers = uniq((members ?? []).map((m) => m?.role_name).filter(Boolean)).sort(
      (a, b) => a.localeCompare(b, 'ko'),
    );
    return uniq([...roles, ...fromTasks, ...fromMembers]);
  }, [tasks, members, roles]);

  // 역할마다 받을 사람 수. 보내는 사람(나)은 빼고 센다 — 아래 「받는 사람」과
  // 보내기 단추가 같은 목록을 보게 하려는 것이다. 여기서 안 빼면 칩은 1인데
  // 받는 사람은 0인 화면이 나온다.
  const countByRole = useMemo(() => {
    const map = new Map();
    for (const r of roleOptions) {
      map.set(r, recipientsForRoles(members, [r], myMemberId).length);
    }
    return map;
  }, [roleOptions, members, myMemberId]);

  // 그 역할에 사람이 아예 없는 것과, 나 말고 없는 것은 다른 사정이다.
  // 앞의 것은 명단을 고치면 되고 뒤의 것은 고칠 것이 없다 — 라우트도 두
  // 경우에 다른 문구를 돌려준다.
  const inRoles = useMemo(() => recipientsForRoles(members, roles), [members, roles]);
  const recipients = useMemo(
    () => recipientsForRoles(members, roles, myMemberId),
    [members, roles, myMemberId],
  );

  const recentByTask = useMemo(() => {
    const map = new Map();
    for (const r of recent ?? []) {
      const list = map.get(r?.task_id) ?? [];
      list.push(r);
      map.set(r?.task_id, list);
    }
    return map;
  }, [recent]);

  const recentFor = (taskId) => recentlyAsked(recentByTask.get(taskId) ?? [], roles);

  const over = tooMany(recipients.length);
  const canSend = picked.size > 0 && recipients.length > 0 && !over && !sending;

  function toggleRole(role) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  function toggleTask(id) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (!canSend) return;
    setError('');
    setSending(true);
    try {
      const res = await fetch(`/api/launch/${launchId}/help-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: [...picked], roles, message }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? '요청을 보내지 못했습니다.');
        setSending(false);
        return;
      }
      // 화면이 센 수가 아니라 서버가 실제로 보낸 수를 말한다. 이름이 빈
      // 사람과 비활성은 조용히 빠지므로 둘이 다를 수 있다.
      const done = { sent: Number(d.sent ?? 0), tasks: Number(d.tasks ?? picked.size) };
      setResult(done);
      setSending(false);
      onSent?.(done);
    } catch {
      setError('요청을 보내지 못했습니다.');
      setSending(false);
    }
  }

  if (!open || (tasks ?? []).length === 0) return null;

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !sending) onClose?.(); }}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader className="shrink-0">
          {/* pr-10 이다. DialogContent 의 기본 닫기 X 가 absolute top-2 right-2 에
              size-7 이라 오른쪽 36px 을 먹는다 — pr-8(32px)로는 4px 모자란다. */}
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-10">
            {many ? (
              <span>
                협조 요청 — <span className="tabular-nums">{picked.size}</span>건
              </span>
            ) : (
              <>
                <span>협조 요청</span>
                <span className="text-sm tabular-nums text-slate-400">{first?.code}</span>
                <span className="min-w-0 flex-1 text-sm font-normal text-slate-700">
                  {first?.title}
                </span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>{launchName}</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] leading-relaxed text-emerald-800">
              <b className="tabular-nums">{result.sent}</b>명에게 보냈습니다
              {result.tasks > 1 && (
                <> · 항목 <span className="tabular-nums">{result.tasks}</span>건</>
              )}
              . 활동에도 남았으니 다른 사람이 또 보내지 않습니다.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] leading-relaxed text-amber-800">
              받는 사람에게 <b>메일이 나갑니다.</b> 활동에도 남아 다른 사람이 또 보내지
              않습니다.
            </p>

            {many && (
              <div className="mb-3">
                <p className="mb-1 text-[11px] text-slate-400">보낼 항목</p>
                <ul className="overflow-hidden rounded-lg border border-slate-200">
                  {(tasks ?? []).map((task) => {
                    const asked = recentFor(task.id);
                    return (
                      <li
                        key={task.id}
                        className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-slate-100 px-3 py-1.5 text-[12.5px] last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={picked.has(task.id)}
                          onChange={() => toggleTask(task.id)}
                          aria-label={`${task.code} ${task.title} 보내기`}
                          className="h-3.5 w-3.5 shrink-0 self-center accent-indigo-600"
                        />
                        <span className="tabular-nums text-xs text-slate-400">{task.code}</span>
                        <span className="min-w-0 flex-1 text-slate-800">{task.title}</span>
                        {asked.length > 0 && (
                          <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10.5px] text-amber-700">
                            24시간 안에 {asked.join(' · ')}에 요청함
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="mb-3">
              <p className="mb-1.5 text-[11px] text-slate-400">어느 역할에</p>
              {roleOptions.length === 0 ? (
                <p className="text-[12px] text-slate-400">
                  이 런칭에 역할이 없습니다 — 참여자 명단부터 채워야 합니다.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {roleOptions.map((role) => {
                    const on = roles.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        aria-pressed={on}
                        className={`rounded-full border px-3 py-1 text-[12px] ${
                          on
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-slate-300 bg-white text-slate-600 hover:border-indigo-400'
                        }`}
                      >
                        {role}
                        <span className="ml-1 text-[10.5px] tabular-nums text-slate-400">
                          {countByRole.get(role) ?? 0}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {!many && first && recentFor(first.id).length > 0 && (
                <p className="mt-1.5 text-[11.5px] text-amber-700">
                  24시간 안에 {recentFor(first.id).join(' · ')}에 이미 요청했습니다. 다시 보낼 수
                  있지만, 답을 기다리는 중일 수 있습니다.
                </p>
              )}
            </div>

            <div className="mb-3">
              <p className="mb-1.5 text-[11px] text-slate-400">받는 사람 — 참여자 명단에서</p>
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-[12.5px] leading-relaxed">
                {recipients.length > 0 && (
                  <>
                    {recipients.map((p) => (
                      <span
                        key={p.id}
                        className="mr-1.5 inline-block rounded bg-indigo-50 px-1.5 py-0.5 text-[12px] text-indigo-700"
                      >
                        {p.name}
                      </span>
                    ))}
                    <span className="text-slate-400">
                      — <span className="tabular-nums">{recipients.length}</span>명에게 한 통씩
                    </span>
                  </>
                )}
                {recipients.length === 0 && inRoles.length > 0 && (
                  <span className="text-amber-700">
                    이 역할에 본인 말고 다른 참여자가 없습니다.
                  </span>
                )}
                {recipients.length === 0 && inRoles.length === 0 && (
                  <span className="text-amber-700">
                    이 역할에 참여자가 없습니다 — 명단에 넣어야 보낼 수 있습니다.
                  </span>
                )}
              </div>
              {over && (
                <p className="mt-1.5 text-[11.5px] text-red-600">
                  한 번에 <span className="tabular-nums">{MAX_RECIPIENTS}</span>명까지 보낼 수
                  있습니다 — 역할을 줄이세요.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="help-message" className="mb-1.5 block text-[11px] text-slate-400">
                한마디 (선택)
              </label>
              <textarea
                id="help-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="언제까지 필요한지 적으면 답이 빨라집니다."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>

            {error && <p className="mt-2 text-[12.5px] text-red-600">{error}</p>}

            <DialogFooter className="mt-3 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onClose?.()}
                disabled={sending}
              >
                그만두기
              </Button>
              <Button type="submit" disabled={!canSend} className="bg-indigo-600 hover:bg-indigo-700">
                {sending && '보내는 중...'}
                {!sending && recipients.length > 0 && `${recipients.length}명에게 보내기`}
                {!sending && recipients.length === 0 && '보내기'}
              </Button>
            </DialogFooter>
          </form>
        )}

        {result && (
          <DialogFooter className="shrink-0">
            <Button type="button" variant="outline" onClick={() => onClose?.()}>
              닫기
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// 순서를 지키며 중복만 뺀다. 역할 칩의 차례가 곧 "무엇부터 보라"는 말이라
// Set 으로 뭉개면 안 된다.
function uniq(list) {
  const seen = new Set();
  const out = [];
  for (const v of list ?? []) {
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
