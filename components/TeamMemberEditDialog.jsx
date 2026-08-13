'use client';

import { useCallback, useEffect, useState } from 'react';
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { groupOrganizations, suggestTierFromOrg } from '@/lib/organizations';
import { activeJobRoles } from '@/lib/jobRoles';
import { TIER_LABELS } from '@/lib/tiers';

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
  const [organizationId, setOrganizationId] = useState(null);
  const [jobRole, setJobRole] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [jobRoles, setJobRoles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 다이얼로그가 열리는 렌더에서 대상 값으로 맞춘다(useEffect 대신 파생 상태).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(member?.name ?? '');
      setOrganizationId(member?.organization_id ?? null);
      setJobRole(member?.job_role_id ?? null);
      setError('');
    }
  }

  // 이 화면은 전체관리자 전용이라 관리용 조회를 쓴다(가입 화면의 공개
  // 조회에는 default_tier 가 없어 제안 등급을 계산할 수 없다).
  const loadOrgs = useCallback(() => {
    Promise.all([
      fetch('/api/organizations').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/job-roles').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([o, j]) => {
        setOrganizations(o?.organizations ?? []);
        setJobRoles(j?.jobRoles ?? []);
      })
      .catch(() => {});
  }, []);
  useEffect(loadOrgs, [loadOrgs]);

  // 이 파일에는 이미 roles(브랜드 배치 목록)가 있다. 이름이 겹치면
  // 어느 쪽인지 읽을 때마다 확인해야 한다.
  const jobRoleOptions = activeJobRoles(jobRoles);

  const { brands: brandOrgs, teams: teamOrgs } = groupOrganizations(organizations);
  const selectedOrg = organizations.find((o) => o.id === organizationId) ?? null;

  // 소속을 바꿨는데 등급이 그대로면 "본부 소속인데 4차" 같은 상태가 남는다.
  // 화면에 아무 경고가 없으면 나중에 "이 사람 왜 상태를 못 바꿔요?"로 돌아온다.
  // 여기서 제안 등급과 현재 배치를 나란히 보여주고, 실제 변경은 팀원 목록의
  // 등급 셀렉트로 하게 둔다 — 한 다이얼로그가 두 테이블을 고치면 절반만
  // 성공했을 때 무엇이 저장됐는지 알 수 없다.
  const proposed = selectedOrg ? suggestTierFromOrg(selectedOrg) : null;
  const roles = member?.brandRoles ?? [];
  const mismatched = proposed ? roles.filter((r) => r.tier !== proposed) : [];
  const affiliationChanged =
    Boolean(organizationId) && organizationId !== (member?.organization_id ?? null);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/team-members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, organizationId, jobRoleId: jobRole }),
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

  const canSubmit = name.trim() && organizationId && jobRole;

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
              items={organizations.map((o) => ({ value: o.id, label: o.name }))}
              value={organizationId}
              onValueChange={setOrganizationId}
            >
              <SelectTrigger id="member-affiliation" className="w-full">
                <SelectValue placeholder="선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {brandOrgs.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>브랜드</SelectLabel>
                    {brandOrgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {teamOrgs.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>본부</SelectLabel>
                    {teamOrgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
            {/* 이관되지 않은 사람은 조직이 비어 있다. 무엇이었는지 보여주지
                않으면 관리자가 아무 조직이나 고르게 된다. */}
            {!member?.organization_id && member?.affiliation && (
              <p className="text-xs text-slate-500">
                이전 소속: {member.affiliation} — 조직을 지정해 주세요
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="member-jobrole">직무</Label>
            <Select
              items={jobRoleOptions.map((r) => ({ value: r.id, label: r.name }))}
              value={jobRole}
              onValueChange={setJobRole}
            >
              <SelectTrigger id="member-jobrole" className="w-full">
                <SelectValue placeholder="선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {jobRoleOptions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
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
                소속을 <b>{selectedOrg?.name}</b>(으)로 바꾸면 제안 등급은{' '}
                <b>{TIER_LABELS[proposed] ?? proposed}</b>입니다. 소속은
                등급을 제안할 뿐이고, 실제 권한은 브랜드별 배치에서 나옵니다.
              </p>
              {roles.length === 0 ? (
                <p className="mt-1">현재 배치된 브랜드가 없습니다. 저장 후 배치해 주세요.</p>
              ) : mismatched.length === 0 ? (
                <p className="mt-1">
                  현재 배치(
                  {roles.map((r) => `${r.brandName} ${TIER_LABELS[r.tier] ?? r.tier}`).join(', ')})가
                  제안과 일치합니다.
                </p>
              ) : (
                <p className="mt-1">
                  현재 배치{' '}
                  {mismatched
                    .map((r) => `${r.brandName} ${TIER_LABELS[r.tier] ?? r.tier}`)
                    .join(', ')}{' '}
                  는 제안과 다릅니다. 필요하면 저장 후 목록에서 등급을 바꿔 주세요.
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
