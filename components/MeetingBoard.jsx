'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AskDialog } from '@/components/AskDialog';
import { RowDispositionMenu } from '@/components/RowDispositionMenu';
import { agendaRule, isAgendaItem } from '@/lib/meetingAgenda';

// 칩은 넷이다.
//
// 예전에는 다섯이었고 그중 '이번 회의 안건'이 사실은 미종결 전부였다.
// 21건이 전부 안건이면 그건 안건이 아니라 목록이라, 이름이 약속하는 것과
// 화면이 주는 것이 달랐다(lib/meetingAgenda.js).
//
// '담당 없는 것만'·'신규'는 칩에서 뺐다. 위 요약 카드를 누르면 그 집합으로
// 좁혀지므로 같은 길이 두 벌이 될 이유가 없다.
const FILTERS = [
  { key: 'agenda', label: '이번 회의 안건' },
  { key: 'all', label: '진행 중 전체' },
  { key: 'awaiting', label: '확인 대기' },
  // '이번 주 완료'가 아니다. 기준이 시간이 아니라 확인 여부라서, 이름도
  // 그대로 말해야 한다 — 확인할 때까지 남는다.
  { key: 'done', label: '확인할 완료' },
];

// 회의 화면 본체.
//
// 이 화면의 규칙 하나: 상세로 들어가지 않는다. 회의는 건당 30초짜리 자리라
// 클릭 세 번이면 안 쓴다. 담당자와 예상일은 목록 행에서 바로 정한다.
export function MeetingBoard({ identity }) {
  const brandId = identity?.brandId ?? null;
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('agenda');
  const [people, setPeople] = useState([]);
  const [rowError, setRowError] = useState({});
  const [asking, setAsking] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [ending, setEnding] = useState(false);
  const [ended, setEnded] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!brandId) return;
    try {
      const res = await fetch(`/api/meeting?brandId=${brandId}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? '불러오지 못했습니다.');
      setData(body);
    } catch (err) {
      setError(err.message);
    }
  }, [brandId]);

  useEffect(() => {
    load();
  }, [load]);

  // 담당자 후보. 그 브랜드에 배치된 사람만 고를 수 있다 — assignee 라우트가
  // 같은 규칙으로 막고 있어서, 여기서 아무나 보여 주면 고른 뒤에 400 이 뜬다.
  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    fetch(`/api/brand-team?brandId=${brandId}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setPeople((body.members ?? []).filter((m) => m.isActive));
      })
      .catch(() => {
        if (!cancelled) setPeople([]);
      });
    return () => {
      cancelled = true;
    };
  }, [brandId]);

  // 저장은 고르는 즉시.
  //
  // 회의 중이라 저장 버튼을 따로 누르게 하면 안 누른 채 다음 건으로 넘어간다.
  // 화면을 먼저 바꾸고 실패하면 되돌린다 — 회의 속도로 눌리는 화면에서
  // 응답을 기다리며 멈춰 있으면 두 번 누르게 된다.
  async function save(id, url, requestBody, optimistic) {
    const before = data;
    setData((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, ...optimistic } : item)),
    }));
    setRowError((prev) => ({ ...prev, [id]: '' }));
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, ...requestBody }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? '저장하지 못했습니다.');
    } catch (err) {
      setData(before);
      setRowError((prev) => ({ ...prev, [id]: err.message }));
    }
  }

  async function endMeeting() {
    setEnding(true);
    setError('');
    try {
      const res = await fetch('/api/meeting/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? '회의를 마치지 못했습니다.');
      setEnded(body);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnding(false);
    }
  }

  // 요건 확인 요청. 보내고 나면 목록을 다시 받는다 — 그 건이 안건에서
  // 빠지고 '확인 대기'로 옮겨가는 것이 곧 결과다.
  async function askRequester(item, question) {
    if (!item) return { ok: false, error: '대상을 찾지 못했습니다.' };
    const res = await fetch(`/api/requirements/${item.id}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, question }),
    }).catch(() => null);
    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      return { ok: false, error: d?.error ?? '보내지 못했습니다.' };
    }
    await load();
    return { ok: true };
  }

  // 완료 건을 회의에서 확인했다고 표시한다.
  //
  // 건별이 기본이다. '회의 마치기'로 한꺼번에 처리하지 않는 이유는 안 본
  // 것까지 확인됨이 되면 이 칸을 만든 뜻이 사라져서다. '전부 확인'은 사람이
  // 그렇게 하겠다고 누르는 것이라 다르다.
  async function markReviewed(ids, reviewed = true) {
    if (ids.length === 0) return;
    setReviewing(true);
    setError('');
    const res = await fetch('/api/meeting/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, ids, reviewed }),
    }).catch(() => null);
    setReviewing(false);
    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? '확인 처리를 하지 못했습니다.');
      return;
    }
    await load();
  }

  // 행에서 바로 보류·반려·취소. 목록 화면과 같은 라우트·같은 창을 쓴다.
  //
  // 처분한 건은 다음 load 에서 안건에서 빠진다 — 종결 상태가 되어 서버 조회에
  // 안 걸린다. 그것이 곧 결과 표시다.
  async function closeFromRow(requirement, status, reason) {
    const res = await fetch(`/api/requirements/${requirement.id}/close`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, status, reason }),
    }).catch(() => null);
    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      return { ok: false, error: d?.error ?? '처리하지 못했습니다.' };
    }
    await load();
    return { ok: true };
  }

  if (!brandId) return <p className="text-sm text-slate-500">브랜드를 먼저 선택해 주세요.</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">불러오는 중...</p>;

  const stallDays = data.stallDays;
  const rows = data.items.filter((item) => {
    // 완료는 따로 볼 때만 나온다. 기본 보기에 섞이면 "지금 손볼 것"이 흐려진다 —
    // 이 화면은 회의에서 밀린 것을 훑는 자리가 먼저다.
    if (filter === 'done') return item.isDone;
    if (item.isDone) return false;
    // 확인 대기는 안건에서 빠진다. 공이 요청자에게 넘어가 있어서 이 회의에서
    // 할 수 있는 일이 없다. 그래도 칩으로는 볼 수 있어야 한다 — 통째로
    // 지우면 물어본 사실이 화면에서 사라진다.
    if (filter === 'awaiting') return Boolean(item.awaiting);
    if (item.awaiting) return false;
    // 안건은 손이 필요한 것만이다. 나머지는 '진행 중 전체'에 있다.
    if (filter === 'agenda') return isAgendaItem({ item });
    // 아래 셋은 요약 카드를 눌렀을 때다.
    if (filter === 'stalled') return item.stalledDays >= stallDays;
    if (filter === 'unassigned') return !item.assignee;
    if (filter === 'incoming') return item.isNew;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">주간회의</h1>
        <p className="mt-1 text-sm text-slate-500">
          손이 필요한 것부터 봅니다. 담당자·예상일을 바로 정하고, 요건이 불명확하면 이 자리에서
          물어볼 수 있습니다.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {/* 카드가 곧 필터다. 예전에는 숫자만 보여주고 아무 일도 안 했는데,
            "담당 없음 6"을 보고 그 여섯을 보려면 아래 칩에서 다시 골라야 했다.
            다시 누르면 안건으로 돌아간다. */}
        <Stat
          label={`${stallDays}일+ 멈춤`}
          value={data.summary.stalled}
          tone="rose"
          active={filter === 'stalled'}
          onClick={() => setFilter(filter === 'stalled' ? 'agenda' : 'stalled')}
        />
        <Stat
          label="담당 없음"
          value={data.summary.unassigned}
          tone="amber"
          active={filter === 'unassigned'}
          onClick={() => setFilter(filter === 'unassigned' ? 'agenda' : 'unassigned')}
        />
        {/* 나머지와 성격이 다르다. 우리가 손댈 것이 아니라 저쪽이 답할 것이다. */}
        <Stat
          label="확인 대기"
          value={data.summary.awaiting ?? 0}
          tone="sky"
          active={filter === 'awaiting'}
          onClick={() => setFilter(filter === 'awaiting' ? 'agenda' : 'awaiting')}
        />
        {/* '이번 주'가 아니라 최근 7일이다. 완료에서 고친 것과 같은 거짓말이
            여기 남아 있었다. */}
        <Stat
          label="최근 7일 신규"
          value={data.summary.incoming}
          tone="slate"
          active={filter === 'incoming'}
          onClick={() => setFilter(filter === 'incoming' ? 'agenda' : 'incoming')}
        />
        {/* 다섯 중 하나는 좋은 소식이어야 한다. 나머지가 전부 문제를 세는
            숫자라, 회의가 나쁜 소식으로만 시작하고 있었다. */}
        <Stat
          label="확인할 완료"
          value={data.summary.done}
          tone="emerald"
          active={filter === 'done'}
          onClick={() => setFilter(filter === 'done' ? 'agenda' : 'done')}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">보기</span>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded px-2.5 py-1 text-xs ${
              filter === f.key
                ? 'bg-indigo-50 font-medium text-indigo-700'
                : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 칩 이름만으로는 무엇이 들어오는지 알 수 없다. 기준을 화면에 쓴다 —
          '안건'이라는 말이 무엇을 가리키는지 짐작하게 두면 안 된다. */}
      <p className="-mt-2 text-xs text-slate-400">
        {filter === 'agenda'
          ? `${agendaRule(stallDays)}. 잘 굴러가는 건은 '진행 중 전체'에 있습니다.`
          : filter === 'all'
            ? '종결되지 않은 건 전부입니다. 확인 대기는 빠집니다.'
            : filter === 'awaiting'
              ? '요청자에게 묻고 답을 기다리는 건입니다. 답이 오면 안건으로 돌아옵니다.'
              : filter === 'done'
                ? '확인하면 이 목록에서 빠집니다. 확인 전에는 기간이 지나도 계속 남습니다.'
                : '요약 카드로 좁힌 화면입니다. 카드를 다시 누르면 안건으로 돌아갑니다.'}
      </p>

      {/* 확인할 완료가 여럿일 때. 회의에서 훑고 넘어가는 경우가 실제로
          있으므로 한 번에 처리하는 길을 준다 — 다만 사람이 눌러야 한다. */}
      {filter === 'done' && rows.length > 1 && (
        <div className="flex items-center justify-between gap-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-xs text-emerald-900">
            확인하면 이 목록에서 빠집니다. 확인 전에는 기간이 지나도 계속 남습니다.
            {/* 몇 건이 확인 내용 없이 완료됐는지 머리에서 먼저 말한다.
                회의에서 어디를 물어야 하는지가 목록을 훑기 전에 보인다. */}
            {rows.filter((r) => !r.closure).length > 0 && (
              <span className="ml-1 font-medium text-amber-800">
                확인 내용 없음 {rows.filter((r) => !r.closure).length}건.
              </span>
            )}
          </p>
          <button
            type="button"
            disabled={reviewing}
            onClick={() => markReviewed(rows.map((r) => r.id))}
            className="shrink-0 rounded bg-emerald-600 px-2.5 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {reviewing ? '처리 중...' : `${rows.length}건 전부 확인`}
          </button>
        </div>
      )}

      {ended && (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {ended.assigned === 0
            ? '회의를 마쳤습니다. 이번 회의에서 새로 배정된 건은 없습니다.'
            : `회의를 마쳤습니다. ${ended.assigned}건이 배정됐고 요청자 ${ended.notified}명에게 알렸습니다.`}
        </p>
      )}

      <ul className="flex flex-col">
        {rows.length === 0 && (
          <li className="py-6 text-sm text-slate-500">
            {/* 완료 0건은 조건이 안 맞는 것이 아니라 그 주의 사실이다.
                회의가 알아야 할 소식이므로 다르게 말한다. */}
            {filter === 'done'
              ? '확인할 완료 건이 없습니다.'
              : filter === 'awaiting'
                ? '요청자 답을 기다리는 건이 없습니다.'
                : filter === 'agenda'
                  ? '이번 회의에서 손볼 건이 없습니다. 잘 굴러가고 있습니다.'
                  : '이 조건에 해당하는 건이 없습니다.'}
          </li>
        )}
        {rows.map((item) => (
          <li
            key={item.id}
            className={`flex flex-wrap items-start gap-3 border-b border-l-2 border-slate-100 py-3 pl-3 ${
              item.isDone
                ? 'border-l-emerald-400'
                : item.assignee
                  ? 'border-l-slate-200'
                  : 'border-l-rose-400'
            }`}
          >
            <div className="min-w-0 flex-1">
              <Link href={`/requirements/${item.id}`} className="text-sm hover:underline">
                {item.title}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                {item.isDone ? (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                    {item.tookDays === null ? '완료' : `${item.tookDays}일 걸림`}
                  </span>
                ) : item.awaiting ? (
                  <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">
                    {item.awaiting.days === null
                      ? '답 기다리는 중'
                      : `${item.awaiting.days}일째 답 기다림`}
                  </span>
                ) : item.stalledDays >= stallDays ? (
                  <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-700">
                    {item.stalledDays}일 멈춤
                  </span>
                ) : item.isNew ? (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">신규</span>
                ) : null}
                <span className="text-slate-500">
                  {item.status} · {item.requester?.name ?? '요청자 없음'} 요청
                </span>
                {/* 승인 확인 내용. 회의에서 "그래서 뭘 확인했나"가 바로 보인다.
                    없으면 없다고 말한다 — closureReason 이 두 글자 미만을
                    걸러내므로 '.' 한 글자는 여기 null 로 온다.
                    운영 12건 중 4건이 그렇다. 점 하나를 그냥 붙여 놓으면
                    훑을 때 안 보이고, 그러면 회의에서 물을 일도 없다.
                    막지 않고 드러낸다 — 최소 글자수를 강제하면 '..' 을 친다. */}
                {item.isDone &&
                  (item.closure ? (
                    <span className="truncate text-slate-400">· {item.closure.reason}</span>
                  ) : (
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">
                      확인 내용 없음
                    </span>
                  ))}
              </div>
              {rowError[item.id] && (
                <p className="mt-1 text-xs text-red-600">{rowError[item.id]}</p>
              )}
            </div>
            {/* 완료 건에서는 감춘다. 끝난 건의 담당자를 바꿀 일이 없고,
                바꾸면 PATCH .../assignee 가 통과해 버려 완료된 건의 담당자가
                조용히 달라진다. */}
            {item.isDone ? (
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-slate-400">
                  {item.assignee?.name ?? '담당자 없음'}
                </span>
                <button
                  type="button"
                  disabled={reviewing}
                  onClick={() => markReviewed([item.id])}
                  className="rounded border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                >
                  확인함
                </button>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                {/* 회의에서 가장 자주 나오는 결론이 "이게 뭔 얘기인지 확인이
                    필요하다"인데, 지금까지 그걸 하려면 상세로 들어가 코멘트에
                    @멘션을 쳐야 했다. 이 화면의 규칙(상세로 안 들어간다)을
                    지키려면 여기 있어야 한다. */}
                {!item.awaiting && item.requester && (
                  <button
                    type="button"
                    onClick={() => setAsking(item)}
                    className="rounded px-2 py-1 text-xs text-sky-700 hover:bg-sky-50"
                  >
                    질문하기
                  </button>
                )}
                <select
                  aria-label={`${item.title} 담당자`}
                  value={item.assignee?.id ?? ''}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    const person = people.find((p) => p.id === id);
                    save(
                      item.id,
                      `/api/requirements/${item.id}/assignee`,
                      { assignee: id },
                      { assignee: id ? { id, name: person?.name ?? '' } : null }
                    );
                  }}
                  className="h-8 rounded border border-slate-200 px-2 text-xs"
                >
                  <option value="">담당 지정</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  aria-label={`${item.title} 배포예상일`}
                  value={item.expectedDate ?? ''}
                  onChange={(e) => {
                    const value = e.target.value || null;
                    save(
                      item.id,
                      `/api/requirements/${item.id}/expected-date`,
                      { expectedReleaseDate: value },
                      { expectedDate: value }
                    );
                  }}
                  className="h-8 rounded border border-slate-200 px-2 text-xs"
                />
                {/* 회의에서 "이건 지금 못 한다"가 나오면 그 자리에서 끝나야
                    한다. 코드 주석은 "상세로 들어가지 않는다"고 약속해 놓고
                    보류·반려만 상세로 보내고 있었다. 목록 행과 같은 것을 쓴다. */}
                <RowDispositionMenu
                  requirement={{
                    id: item.id,
                    title: item.title,
                    status: item.status,
                    requester: item.requester,
                  }}
                  identity={identity}
                  onClose={closeFromRow}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      <AskDialog
        open={Boolean(asking)}
        requesterName={asking?.requester?.name}
        onSubmit={(question) => askRequester(asking, question)}
        onClose={() => setAsking(null)}
      />

      {/* 회의 마치기가 루프를 닫는 지점이다. 이 회의에서 배정된 건의 요청자가
          "내가 올린 게 어떻게 됐는지"를 아는 유일한 통로다. */}
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
        <p className="text-xs text-slate-500">
          마치면 이 회의에서 배정된 건의 요청자에게 메일이 갑니다.
        </p>
        <Button
          type="button"
          onClick={endMeeting}
          disabled={ending}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          {ending ? '마치는 중...' : '회의 마치기'}
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, active, onClick }) {
  const tones = {
    rose: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-800',
    slate: 'bg-slate-100 text-slate-700',
    sky: 'bg-sky-50 text-sky-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={Boolean(active)}
      className={`rounded px-3 py-2 text-left hover:brightness-95 ${tones[tone]} ${
        active ? 'ring-2 ring-slate-900/25' : ''
      }`}
    >
      <div className="text-xs opacity-80">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </button>
  );
}
