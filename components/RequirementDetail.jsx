'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useIdentity } from '@/components/IdentityProvider';
import { canProcess, isGlobalAdmin } from '@/lib/tiers';
import {
  DIRECT_STATUSES,
  DONE_STATUS,
  MERGED_STATUS,
  REJECTED_STATUS,
  CANCELLED_STATUS,
  APPROVAL_PENDING_STATUS,
  REVIEW_IN_PROGRESS_STATUS,
  REVIEW_PENDING_STATUS,
} from '@/lib/statuses';
import { canApprove } from '@/lib/approval';
import { STATUS_META } from '@/lib/statusMeta';
import { canSubmitForReview } from '@/lib/submitRequirement';
import { isOverdue, toLocalDateString } from '@/lib/overdue';
import { isImageType } from '@/lib/imageUpload';
import { RequirementEditForm } from '@/components/RequirementEditForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RequirementLinks } from '@/components/RequirementLinks';
import { RequirementHeader } from '@/components/RequirementHeader';
import { RequirementStatusActions } from '@/components/RequirementStatusActions';
import { RequirementSidebar } from '@/components/RequirementSidebar';
import { RequirementAttachments } from '@/components/RequirementAttachments';
import { headline } from '@/lib/headline';
import { stalledDays } from '@/lib/stalled';
import { ActivityFeed } from '@/components/ActivityFeed';
import { ChecklistSection } from '@/components/ChecklistSection';
import { RequirementDangerZone } from '@/components/RequirementDangerZone';
import { ApprovalDialog } from '@/components/ApprovalDialog';
import { StartReviewDialog } from '@/components/StartReviewDialog';
import { RedmineLinkSection } from '@/components/RedmineLinkSection';
import { HelpHint } from '@/components/HelpHint';
import { canDeleteRequirement } from '@/lib/deleteRequirement';
import { REQUIREMENT_TYPES, UNTYPED_LABEL, typeLabel } from '@/lib/requirementTypes';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function RequirementDetail({ id }) {
  const { identity } = useIdentity();
  const [editing, setEditing] = useState(false);
  // 승인 창 열림 여부. 완료로 가려는 모든 경로가 이 창을 지난다.
  const [approvalOpen, setApprovalOpen] = useState(false);
  // 착수 창. 검토대기 → 검토중 으로 갈 때 담당자·예상일을 받는다.
  const [startOpen, setStartOpen] = useState(false);
  // 종결 건의 '재개'가 여는 창. 예전에는 보드 밖 상태일 때만 나타나는 별도
  // Select 였는데, 주 버튼 하나로 들어오면서 창이 됐다.
  const [resumeOpen, setResumeOpen] = useState(false);
  const [data, setData] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [myBrands, setMyBrands] = useState([]);
  // loadError: 최초/재조회 실패 — 화면 전체를 대체한다.
  // actionError: 상태·담당자·이미지 조작 실패 — 이미 불러온 화면은 유지한 채 배너로만 보여준다.
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [newFiles, setNewFiles] = useState([]);
  // 목록과 같은 지연 판정을 쓰기 위한 '오늘'. 마운트 시점에 한 번만 잡는다.
  const [today] = useState(() => toLocalDateString(new Date()));

  useEffect(() => {
    fetch('/api/team-members')
      .then((res) => res.json())
      .then((d) => setTeamMembers(d.teamMembers ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => {});
    fetch('/api/my-brands')
      .then((res) => res.json())
      .then((d) => setMyBrands(d.brands ?? []))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    fetch(`/api/requirements/${id}`)
      .then((res) => res.json().then((d) => ({ res, d })))
      .then(({ res, d }) => {
        if (!res.ok) throw new Error(d.error ?? '불러오지 못했습니다.');
        setData(d);
        setLoadError('');
      })
      .catch((e) => setLoadError(e.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // 처리 권한은 "지금 선택한 브랜드"가 아니라 이 요구사항 자신의 브랜드 등급으로 판정한다.
  // 프로젝트 상세 보드에서 다른 브랜드 요구사항으로 넘어올 수 있게 되면서, identity.tier
  // (선택한 브랜드의 등급)로 판정하면 편집 UI를 띄워놓고 저장은 403이 나거나 그 반대가 된다.
  const requirementBrandId = data?.requirement?.brand_id ?? identity.brandId;
  const processAllowed = useMemo(() => {
    if (isGlobalAdmin(identity)) return true;
    const tier = myBrands.find((b) => b.id === requirementBrandId)?.tier;
    // my-brands가 아직 안 왔으면 편집 UI를 먼저 띄우지 않는다(깜빡임 + 오조작 방지).
    return canProcess({ isGlobalAdmin: false, tier });
  }, [identity, myBrands, requirementBrandId]);

  // 유형은 3차 이상뿐 아니라 요청자 본인도 바꿀 수 있다. 서버의 PATCH .../[id]
  // 규칙(canProcess || isOwner)과 같은 판정이라, 화면에 열어 두고 저장이 403 이
  // 나거나 그 반대가 되는 일이 없다.
  const typeEditable = processAllowed || data?.requirement?.requester?.id === identity.memberId;

  async function changeStatus(status) {
    setActionError('');
    // 완료는 상태 변경 API 가 받지 않는다. 보드와 같은 창을 띄운다 —
    // 보드만 막아 두면 이 Select 가 우회로가 된다.
    //
    // 상세 API 는 assignee 를 { id, name } 으로 조인해 내려주는데 canApprove 는
    // id 문자열을 본다. 객체를 그대로 넘기면 {...} === 'm1' 이 항상 거짓이라
    // 담당자 본인 판정이 조용히 통과한다.
    if (status === DONE_STATUS) {
      const verdict = canApprove({
        requirement: {
          status: data?.requirement?.status,
          assignee: data?.requirement?.assignee?.id ?? null,
        },
        actor: { memberId: identity.memberId, isGlobalAdmin: isGlobalAdmin(identity) },
      });
      if (!verdict.allowed) {
        setActionError(verdict.reason);
        return;
      }
      setApprovalOpen(true);
      return;
    }

    // 보드와 같은 지점을 막는다. 여기만 열어 두면 상세 Select 가 우회로가 된다.
    if (
      data?.requirement?.status === REVIEW_PENDING_STATUS &&
      status === REVIEW_IN_PROGRESS_STATUS
    ) {
      setStartOpen(true);
      return;
    }

    const res = await fetch(`/api/requirements/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId: requirementBrandId, status }),
    });
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error ?? '상태 변경 실패');
      return;
    }
    load();
  }

  // 주 버튼 한 개가 상태에 따라 다른 곳으로 간다. 어디로 갈지는
  // STATUS_META.primary.via 가 정한다 — 화면이 상태 이름으로 다시 분기하면
  // 상태를 추가할 때 여기를 빼먹고, 그러면 버튼이 조용히 아무 일도 안 한다.
  async function runPrimary() {
    const primary = STATUS_META[data?.requirement?.status]?.primary;
    if (!primary) return;
    if (primary.via === 'submit') return submitForReview();
    if (primary.via === 'start') return setStartOpen(true);
    if (primary.via === 'approve') return setApprovalOpen(true);
    if (primary.via === 'resume') return setResumeOpen(true);
    return changeStatus(primary.to);
  }

  // 종결(반려·취소)은 상태 변경과 다른 라우트를 쓴다. BOARD_STATUSES 밖의
  // 상태이고 사유가 필수라서, PATCH .../status 로는 보낼 수 없다.
  async function closeRequirement(status, reason) {
    setActionError('');
    const res = await fetch(`/api/requirements/${id}/close`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId: requirementBrandId, status, reason }),
    });
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error ?? '종결 실패');
      return false;
    }
    load();
    return true;
  }

  // 배포예상일. 비우면 null 로 보내 해제한다 — 빈 문자열을 보내면 API 의
  // 날짜 형식 검사에 걸려 400 이 된다.
  async function changeExpectedDate(value) {
    setActionError('');
    const res = await fetch(`/api/requirements/${id}/expected-date`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandId: requirementBrandId,
        expectedReleaseDate: value ? value : null,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error ?? '배포예상일 변경 실패');
      return false;
    }
    load();
    return true;
  }

  // 유형만 따로 보낸다. 수정 폼을 열면 전체 필드가 함께 나가서 활동 이력에
  // "제목, 우선순위, 카테고리, 채널, 유형, As-Is, To-Be, 비고 수정" 이 남는다 —
  // 실제로 바뀐 건 유형 하나인데도. 여기서는 한 필드만 보내므로 이력도 한 줄이다.
  async function changeType(value) {
    setActionError('');
    const res = await fetch(`/api/requirements/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandId: requirementBrandId,
        requirementType: value === '__none__' ? null : value,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error ?? '유형 변경 실패');
      return;
    }
    load();
  }

  async function changeAssignee(assignee) {
    setActionError('');
    const res = await fetch(`/api/requirements/${id}/assignee`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandId: requirementBrandId,
        assignee: assignee === '__none__' ? null : assignee,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error ?? '담당자 변경 실패');
      return;
    }
    load();
  }

  async function changeProject(nextProjectId) {
    setActionError('');
    const res = await fetch(`/api/requirements/${id}/project`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: nextProjectId === 'none' ? null : nextProjectId }),
    });
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error ?? '프로젝트 변경 실패');
      return;
    }
    load();
  }

  async function uploadNew() {
    if (newFiles.length === 0) return;
    setActionError('');
    const fd = new FormData();
    fd.append('brandId', requirementBrandId);
    newFiles.forEach((f) => fd.append('files', f));
    const res = await fetch(`/api/requirements/${id}/images`, { method: 'POST', body: fd });
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error ?? '이미지 업로드 실패');
      return;
    }
    setNewFiles([]);
    load();
  }

  async function deleteImage(imageId) {
    if (!window.confirm('이미지를 삭제하시겠습니까? 되돌릴 수 없습니다.')) return;
    setActionError('');
    const res = await fetch(
      `/api/requirements/${id}/images/${imageId}?brandId=${requirementBrandId}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error ?? '이미지 삭제 실패');
      return;
    }
    load();
  }

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!data) return <p className="text-sm text-slate-500">불러오는 중...</p>;

  const { requirement: r, history, duplicates, mergedInto, images, statusDurations, commentCount } =
    data;
  // 이미지와 문서는 보여주는 방식이 다르다. 한 테이블(requirement_images)을
  // 공유하므로 content_type 으로 여기서 가른다.
  const pics = (images ?? []).filter((f) => isImageType(f.content_type));
  const docs = (images ?? []).filter((f) => !isImageType(f.content_type));

  const canEdit =
    (processAllowed || r.requester?.id === identity.memberId) &&
    r.status !== DONE_STATUS &&
    r.status !== MERGED_STATUS;
  // canEdit이 false로 바뀌면(예: 편집 중 상태를 완료/중복으로 변경) 편집 폼을 자동으로 닫는다.
  const showEditForm = editing && canEdit;

  // 브랜드가 '검토 요청'을 누르는 길. 상태 변경(3차 이상)과 다른 라우트를 쓴다 —
  // 목적지가 검토대기 하나로 고정이라 4차에게도 열어도 안전하다.
  async function submitForReview() {
    setActionError('');
    const res = await fetch(`/api/requirements/${id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId: requirementBrandId }),
    });
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error ?? '검토 요청 실패');
      return;
    }
    refresh();
  }

  // 정체 일수는 회의 화면과 같은 함수를 쓴다. 회의 안건에 오른 건을 상세에서
  // 열었을 때 다른 숫자가 보이면 둘 중 하나가 틀린 것이다.
  //
  // 코멘트는 넘기지 않는다 — ActivityFeed 가 자기 엔드포인트에서 따로 불러오고,
  // 그것 하나를 위해 상세 API 를 늘리는 것보다 정체 판정이 코멘트 하나만큼
  // 늦어지는 편이 낫다.
  const days = stalledDays({
    requirement: r,
    changeLogs: history ?? [],
    now: new Date().toISOString(),
  });
  const head = headline({ requirement: r, stalledDays: days, viewer: identity, today });
  // 데스크톱과 모바일이 같은 컨트롤을 쓴다. compact 만 다르다.
  const actionProps = {
    status: r.status,
    identity,
    action: head.action,
    onPrimary: runPrimary,
    onTransition: changeStatus,
    onClose: closeRequirement,
    // '수정'은 예전에 화면에 한 줄을 통째로 차지하는 링크였다. 자주 쓰는
    // 행동이 아니라 메뉴가 맞다.
    onEdit: canEdit && !showEditForm ? () => setEditing(true) : null,
  };

  return (
    // 최대 폭을 준다. 없으면 1900px 화면에서 본문 열이 1200px 이 되는데
    // 글줄은 68ch(약 600px)에서 멈추므로 그 오른쪽 600px 이 통째로 빈다.
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <Link href="/requirements" className="text-sm text-slate-500 hover:text-slate-700">
        ← 목록으로
      </Link>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {mergedInto && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          이 요청은{' '}
          <Link href={`/requirements/${mergedInto.id}`} className="text-indigo-600 underline">
            &lsquo;{mergedInto.title}&rsquo;
          </Link>{' '}
          요청에 병합되었습니다.
        </div>
      )}

      {/* 머리 줄은 grid 밖이다. 모바일에서 이 한 줄이 상단에 있어야 하고,
          본문 안에 넣으면 오른쪽 열과 순서가 얽힌다. */}
      <RequirementHeader
        requirement={r}
        head={head}
        durations={statusDurations}
        counts={{ attachments: images?.length ?? 0, comments: commentCount ?? 0 }}
        projectName={r.project?.name}
        typeLabel={r.requirement_type}
        actions={<RequirementStatusActions {...actionProps} />}
        actionsCompact={<RequirementStatusActions {...actionProps} compact />}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-4">
          {showEditForm ? (
            <RequirementEditForm
              requirement={r}
              canSetConfidential={processAllowed}
              identity={identity}
              onSaved={() => {
                setEditing(false);
                load();
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              {/* 카드 셋을 걷어내고 문서 한 장으로. 상자가 같은 무게로 셋이
                  있으면 읽는 순서가 생기지 않는다. 순서는 그대로 As-Is → To-Be
                  다 — 문제를 먼저 읽는 것이 자연스럽다. */}
              <div className="max-w-[68ch]">
                <p className="mb-1.5 text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
                  As-Is
                </p>
                <p className="text-sm leading-7 whitespace-pre-wrap text-slate-800">
                  {r.as_is || '-'}
                </p>
              </div>

              {/* To-Be 를 확실히 띄운다.
                  배포해 보니 선 하나로는 부족했다 — 1900px 화면에서 2px 선은
                  사라지고, As-Is 가 열 줄이 넘으면 To-Be 가 아래로 밀려 둘의
                  무게가 같아 보인다. 배경과 굵은 선과 큰 라벨을 함께 준다. */}
              <div className="max-w-[68ch] rounded-r border-l-4 border-indigo-500 bg-indigo-50/50 py-3 pr-4 pl-4">
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-indigo-700">
                  TO-BE
                </p>
                <p className="text-sm leading-7 whitespace-pre-wrap text-slate-800">
                  {r.to_be || '-'}
                </p>
              </div>
            </>
          )}

          <RequirementAttachments
            pics={pics}
            docs={docs}
            canEdit={canEdit}
            onDelete={deleteImage}
            newFiles={newFiles}
            onAddFiles={(added) => setNewFiles((prev) => [...prev, ...added])}
            onRemoveFile={(i) => setNewFiles((prev) => prev.filter((_, idx) => idx !== i))}
            onUpload={uploadNew}
          />

          {/* 비고는 접는다. 참고 사항이라 늘 펴 둘 값어치가 없다. */}
          {r.note && (
            <details className="max-w-[68ch] border-y border-slate-100 py-2">
              <summary className="cursor-pointer text-sm text-slate-500">비고</summary>
              <p className="mt-2 text-sm leading-7 whitespace-pre-wrap text-slate-800">{r.note}</p>
            </details>
          )}

          {/* 대화를 본문 바로 아래로 올린다. 지금은 스크롤 맨 끝인데, 코멘트
              42건이 이 앱에서 유일하게 살아 있는 협업 신호다. */}
          <ActivityFeed
            requirementId={id}
            brandId={requirementBrandId}
            history={history}
            memberId={identity.memberId}
          />
        </div>

        {/* 오른쪽 열은 본문 아래로 내려간다(모바일). 예전에는 order-first 로
            본문 위에 올렸는데, 그 이유("폰으로 여는 까닭은 내 요청 어디까지
            왔나 하나")를 이제 머리 줄이 대신한다. */}
        <RequirementSidebar
          assigneeFilled={Boolean(r.assignee)}
          assigneeSlot={
            processAllowed ? (
              <Select
                items={[
                  { value: '__none__', label: '미지정' },
                  ...teamMembers.map((m) => ({ value: m.id, label: m.name })),
                ]}
                value={r.assignee?.id ?? '__none__'}
                onValueChange={changeAssignee}
              >
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">미지정</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-slate-900">{r.assignee?.name ?? '미지정'}</span>
            )
          }
          statusText={r.status}
          expectedSlot={
            <ExpectedDateField
              key={r.expected_release_date ?? '__none__'}
              value={r.expected_release_date}
              overdue={isOverdue(r.expected_release_date, r.status, today)}
              editable={processAllowed}
              onSave={changeExpectedDate}
            />
          }
          projectSlot={
            processAllowed ? (
              <Select
                items={[
                  { value: 'none', label: '선택 안 함' },
                  ...projects.map((pr) => ({ value: pr.id, label: pr.name })),
                ]}
                value={r.project_id ?? 'none'}
                onValueChange={changeProject}
              >
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">선택 안 함</SelectItem>
                  {projects.map((pr) => (
                    <SelectItem key={pr.id} value={pr.id}>
                      {pr.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : r.project ? (
              <Link href={`/projects/${r.project.id}`} className="text-indigo-600 hover:underline">
                {r.project.name}
              </Link>
            ) : (
              <span className="text-slate-400">—</span>
            )
          }
          typeSlot={
            typeEditable ? (
              <Select
                items={[
                  { value: '__none__', label: UNTYPED_LABEL },
                  ...REQUIREMENT_TYPES.map((t) => ({ value: t, label: t })),
                ]}
                value={r.requirement_type ?? '__none__'}
                onValueChange={changeType}
              >
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{UNTYPED_LABEL}</SelectItem>
                  {REQUIREMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-slate-900">{typeLabel(r.requirement_type)}</span>
            )
          }
          redmineSlot={
            <RedmineLinkSection
              requirementId={id}
              brandId={requirementBrandId}
              requirement={r}
              canEdit={processAllowed}
              onSaved={load}
            />
          }
          extras={
            <>
              {/* 연결과 하위 작업을 오른쪽으로 옮겼다. 둘 다 짧은 목록이고
                  "이 건에 딸린 것"이라 메타 성격이다. 본문 아래에 카드로
                  붙어 있을 때는 비어 있어도 각각 90px 을 먹었다.
                  대화는 본문에 남긴다 — 코멘트는 문장이라 300px 열에서 읽기
                  나쁘고, 위로 올린 이유가 그대로 사라진다. */}
              <ChecklistSection
                requirementId={id}
                brandId={requirementBrandId}
                canManage={processAllowed}
              />
              <RequirementLinks requirementId={id} brandId={requirementBrandId} />
            </>
          }
          request={{
            summary: `${r.requester?.name ?? '요청자 없음'} · ${r.request_date ?? '요청일 없음'}`,
            rows: [
              ['카테고리', r.category?.category_name ?? '미분류'],
              ['채널', r.channel ?? '미지정'],
              ['우선순위', r.priority ?? '미지정'],
              ['요청자', r.requester?.name ?? '-'],
              ['요청일', r.request_date ?? '-'],
            ],
          }}
        />
      </div>

      {duplicates.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-slate-500">이 요청에 병합된 요청</h2>
          <ul className="flex flex-col gap-1 text-sm text-slate-700">
            {duplicates.map((d) => (
              <li key={d.id}>
                {d.linked_note} — 요청자 {d.requester?.name ?? '-'}
              </li>
            ))}
          </ul>
        </section>
      )}

      <StartReviewDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        requirement={r}
        brandId={requirementBrandId}
        teamMembers={teamMembers}
        onStarted={load}
      />

      {/* 완료로 가는 두 입구(Select, 승인 버튼)가 같은 창을 연다. */}
      <ApprovalDialog
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
        requirement={r}
        brandId={requirementBrandId}
        onApproved={load}
      />

      {/* 종결 건의 '재개'가 여는 창. 예전에는 보드 밖 상태일 때만 나타나는
          별도 Select 였는데, 주 버튼 하나로 들어오면서 창이 됐다.
          완료는 목록에 없다 — 서버가 PATCH /status 로 오는 완료를 거부한다. */}
      <Dialog open={resumeOpen} onOpenChange={setResumeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>어느 상태로 되돌릴까요?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {DIRECT_STATUSES.map((st) => (
              <Button
                key={st}
                type="button"
                variant="outline"
                onClick={() => {
                  setResumeOpen(false);
                  changeStatus(st);
                }}
              >
                {st}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* 영구 삭제는 화면 맨 아래, 전체 관리자에게만. 서버도 같은 판정을 다시 한다. */}
      {canDeleteRequirement(identity) && (
        <RequirementDangerZone
          requirementId={id}
          summary={{
            historyCount: history?.length ?? 0,
            commentCount: commentCount ?? 0,
            imageCount: images?.length ?? 0,
            mergedCount: duplicates?.length ?? 0,
          }}
        />
      )}
    </div>
  );
}

// 배포예상일 입력.
//
// onChange 로 바로 저장하지 않는다. input[type=date] 는 사용자가 연·월·일을
// 채워 넣는 도중에도 이벤트를 흘리고 그때 value 는 빈 문자열이라, 즉시 저장하면
// 날짜를 고치려던 사람이 값을 지워버리게 된다. 로컬 상태로 받아두고 명시적으로
// 저장한다.
//
// props: value('YYYY-MM-DD'|null), overdue, editable, onSave(value) => Promise<boolean>
function ExpectedDateField({ value, overdue, editable, onSave }) {
  // 저장 후 상세를 다시 불러오면 value 가 바뀐다. 그때 입력칸도 따라가야 하는데,
  // effect 로 동기화하면 cascading render 가 된다. 부모가 value 를 key 로 주므로
  // 값이 바뀌면 이 컴포넌트가 새로 마운트되고 draft 도 자연히 새 값으로 시작한다.
  const [draft, setDraft] = useState(value ?? '');
  const [saving, setSaving] = useState(false);

  const dirty = draft !== (value ?? '');

  async function save() {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  }

  // 라벨은 그리지 않는다. 이제 PropertyRow 안에 들어가고, 그 행이 이미
  // '배포예상일'을 말한다. 예전에는 이 컴포넌트가 한 줄을 통째로 그렸다.
  if (!editable) {
    return (
      <span className={overdue ? 'font-medium text-rose-600' : 'text-slate-900'}>
        {value ? (overdue ? `⚠ ${value} 지연` : value) : '—'}
      </span>
    );
  }

  // 값이 없으면 회색 '—' 대신 유도 문구를 보여준다. 44건 중 7건만 채워져
  // 있어서, 그냥 두면 오른쪽 열 네 줄 중 절반이 늘 비어 보인다.
  if (!value && !dirty) {
    return (
      <button
        type="button"
        onClick={() => setDraft(new Date().toISOString().slice(0, 10))}
        className="text-indigo-600 hover:underline"
      >
        ＋ 정하기
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="date"
        aria-label="배포예상일"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-32 rounded border border-slate-300 px-1.5 py-0.5 text-xs focus:border-indigo-400 focus:outline-none"
      />
      {dirty && (
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="shrink-0 rounded bg-slate-900 px-1.5 py-0.5 text-[11px] text-white disabled:opacity-40"
        >
          {saving ? '...' : draft ? '저장' : '해제'}
        </button>
      )}
    </div>
  );
}
