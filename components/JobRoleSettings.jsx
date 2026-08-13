'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// 직무 관리. 조직 관리(OrganizationSettings)와 같은 모양이되 훨씬 단순하다 —
// 연결 브랜드도 기본 등급도 없고 이름 하나뿐이다.
//
// 이 목록도 가입 화면에 그대로 노출되므로 지우지 않고 끄기만 한다.
export function JobRoleSettings() {
  const [jobRoles, setJobRoles] = useState([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState('');

  const load = useCallback(() => {
    fetch('/api/job-roles')
      .then((r) => r.json())
      .then((d) => setJobRoles(d.jobRoles ?? []))
      .catch(() => setError('목록을 불러오지 못했습니다.'));
  }, []);

  useEffect(load, [load]);

  async function send(url, method, body) {
    setError('');
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? '변경하지 못했습니다.');
      return false;
    }
    return true;
  }

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const ok = await send('/api/job-roles', 'POST', { name });
    setBusy(false);
    if (!ok) return;
    setName('');
    load();
  }

  async function saveEdit() {
    if (!draftName.trim()) return;
    setBusy(true);
    const ok = await send(`/api/job-roles/${editingId}`, 'PATCH', { name: draftName });
    setBusy(false);
    if (!ok) return;
    setEditingId(null);
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-slate-900">직무 추가</p>
        <div className="flex items-end gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="job-name">이름</Label>
            <Input
              id="job-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) 홍보"
            />
          </div>
          <Button onClick={create} disabled={!name.trim() || busy}>
            {busy ? '추가 중...' : '추가'}
          </Button>
        </div>
        {/* 새 직무가 어디에 끼는지 미리 말해 준다. 추가하고 나서 목록을
            훑으며 찾게 만들 이유가 없다. */}
        <p className="mt-2 text-xs text-slate-500">새 직무는 &apos;기타&apos; 바로 앞에 붙습니다.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">이름</th>
              <th className="px-4 py-2 text-center font-medium">사용</th>
              <th className="px-4 py-2 text-right font-medium">수정</th>
            </tr>
          </thead>
          <tbody>
            {jobRoles.map((r) =>
              editingId === r.id ? (
                <tr key={r.id} className="border-t border-slate-100 bg-indigo-50/40">
                  <td className="px-4 py-2">
                    <Input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="h-8"
                      aria-label="직무 이름"
                    />
                  </td>
                  <td className="px-4 py-2 text-center text-xs text-slate-400">—</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        onClick={saveEdit}
                        disabled={!draftName.trim() || busy}
                        className="h-8 px-3"
                      >
                        저장
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setEditingId(null)}
                        className="h-8 px-3"
                      >
                        취소
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr
                  key={r.id}
                  className={`border-t border-slate-100 ${r.is_active ? '' : 'text-slate-400'}`}
                >
                  <td className="px-4 py-2">
                    <span className={r.is_active ? 'text-slate-900' : ''}>{r.name}</span>
                    {!r.is_active && <span className="ml-2 text-xs">(사용 안 함)</span>}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={r.is_active}
                      onChange={async (e) => {
                        await send(`/api/job-roles/${r.id}`, 'PATCH', {
                          isActive: e.target.checked,
                        });
                        load();
                      }}
                      className="h-4 w-4 accent-indigo-600"
                      aria-label={`${r.name} 사용`}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(r.id);
                        setDraftName(r.name);
                        setError('');
                      }}
                      className="text-xs text-indigo-600 underline hover:text-indigo-800"
                    >
                      수정
                    </button>
                  </td>
                </tr>
              )
            )}
            {jobRoles.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  아직 직무가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        이름을 바꾸면 이미 그 직무로 가입한 사람의 표시도 함께 바뀝니다. 가입 당시에 무엇으로
        신청했는지는 따로 남습니다.
      </p>
    </div>
  );
}
