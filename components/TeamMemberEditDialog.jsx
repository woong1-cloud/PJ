'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AFFILIATIONS, JOB_ROLES, suggestTier } from '@/lib/signup';

// 팀원 이름·소속·직무 수정.
//
// 이 세 값은 가입 때 한 번 적고 영구 고정이었다. 사람이 브랜드에서 본부로
// 옮기거나 직무가 바뀌거나 가입할 때 잘못 골랐으면 고칠 방법이 SQL 뿐이었다.
//
// 등급은 여기서 바꾸지 않는다. 등급은 브랜드마다 따로 붙는 값이고(user_brand_roles),
// 이 다이얼로그는 사람 자체의 정보만 다룬다. 대신 소속을 바꾸면 등급 제안이
// 달라지므로 그 사실을 알려 준다 — 아래 주석 참조.
//
// props: open, onOpenChange, member, onSaved
export function TeamMemberEditDialog({ open, onOpenChange, member, onSaved }) {
  const [name, setName] = useState('');
  const [affiliation, setAffiliation] = useState(null);
  const [jobRole, setJobRole] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 다이얼로그가 열리는 렌더에서 대상 값으로 맞춘다(useEffect 대신 파생 상태).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(member?.name ?? '');
      setAffiliation(member?.affiliation ?? null);
      setJobRole(member?.job_role ?? null);
      setError('');
    }
  }

  // 소속을 바꿨는데 등급이 그대로면 "본부 소속인데 4차" 같은 상태가 남는다.
  // 화면에 아무 경고가 없으면 나중에 "이 사람 왜 상태를 못 바꿔요?"로 돌아온다.
  // 여기서 제안 등급과 현재 배치를 나란히 보여주고, 실제 변경은 팀원 목록의
  // 등급 셀렉트로 하게 둔다 — 한 다이얼로그가 두 테이블을 고치면 절반만
  // 성공했을 때 무엇이 저장됐는지 알 수 없다.
  const proposed = affiliation ? suggestTier(affiliation) : null;
  const roles = member?.brandRoles ?? [];
  const mismatched = proposed ? roles.filter((r) => r.tier !== proposed) : [];
  const affiliationChanged = Boolean(affiliation) && affiliation !== member?.affiliation;

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/team-members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, affiliation, jobRole }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? '저장에 실패했습니다.');
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = name.trim() && affiliation && jobRole;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>팀원 정보 수정</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 break-keep text-sm">
          {error && <p className="text-red-600">{error}</p>}
          <div className="flex flex-col gap-1">
            <Label htmlFor="member-name">이름</Label>
            <Input
              id="member-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="member-affiliation">소속</Label>
            <Select
              items={AFFILIATIONS.map((a) => ({ value: a, label: a }))}
              value={affiliation}
              onValueChange={setAffiliation}
            >
              <SelectTrigger id="member-affiliation" className="w-full">
                <SelectValue placeholder="선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {AFFILIATIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="member-jobrole">직무</Label>
            <Select
              items={JOB_ROLES.map((r) => ({ value: r, label: r }))}
              value={jobRole}
              onValueChange={setJobRole}
            >
              <SelectTrigger id="member-jobrole" className="w-full">
                <SelectValue placeholder="선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {JOB_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 소속을 바꿨을 때만 띄운다. 안 바꿨는데도 계속 보이면 경고가 배경이
              되어 정작 바꿨을 때 눈에 안 들어온다. */}
          {affiliationChanged && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p>
                소속을 <b>{affiliation}</b>로 바꾸면 제안 등급은 <b>{proposed}</b>입니다. 소속은
                등급을 제안할 뿐이고, 실제 권한은 브랜드별 배치에서 나옵니다.
              </p>
              {roles.length === 0 ? (
                <p className="mt-1">현재 배치된 브랜드가 없습니다. 저장 후 배치해 주세요.</p>
              ) : mismatched.length === 0 ? (
                <p className="mt-1">
                  현재 배치({roles.map((r) => `${r.brandName} ${r.tier}`).join(', ')})가 제안과
                  일치합니다.
                </p>
              ) : (
                <p className="mt-1">
                  현재 배치 {mismatched.map((r) => `${r.brandName} ${r.tier}`).join(', ')} 는 제안과
                  다릅니다. 필요하면 저장 후 목록에서 등급을 바꿔 주세요.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={submitting || !canSubmit}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {submitting ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
