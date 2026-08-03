'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useIdentity } from '@/components/IdentityProvider';
import { canProcess, isGlobalAdmin } from '@/lib/tiers';
import {
  BOARD_STATUSES,
  DONE_STATUS,
  MERGED_STATUS,
  REJECTED_STATUS,
  CANCELLED_STATUS,
  APPROVAL_PENDING_STATUS,
  REVIEW_IN_PROGRESS_STATUS,
  REVIEW_PENDING_STATUS,
} from '@/lib/statuses';
import { canApprove } from '@/lib/approval';
import { statusStyle } from '@/lib/statusMeta';
import { canSubmitForReview } from '@/lib/submitRequirement';
import { isOverdue, toLocalDateString } from '@/lib/overdue';
import { Badge } from '@/components/ui/badge';
import { ImageDropzone } from '@/components/ImageDropzone';
import { RequirementEditForm } from '@/components/RequirementEditForm';
import { RequirementLinks } from '@/components/RequirementLinks';
import { ActivityFeed } from '@/components/ActivityFeed';
import { StatusDurations } from '@/components/StatusDurations';
import { ChecklistSection } from '@/components/ChecklistSection';
import { RequirementDangerZone } from '@/components/RequirementDangerZone';
import { ApprovalDialog } from '@/components/ApprovalDialog';
import { StartReviewDialog } from '@/components/StartReviewDialog';
import { canDeleteRequirement } from '@/lib/deleteRequirement';
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

  const isOffBoard = !BOARD_STATUSES.includes(r.status);
  // 병합된 건은 종결할 수 없다(API도 막는다). 이미 반려·취소된 건은 서로
  // 바꿀 수 있게 둔다 — 잘못 누른 것을 고칠 방법이 있어야 한다.
  const canClose = r.status !== MERGED_STATUS;

  return (
    <div className="flex flex-col gap-4">
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-slate-900">{r.title}</h1>
            {canEdit && !showEditForm && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-sm text-indigo-600 hover:underline"
              >
                수정
              </button>
            )}
          </div>
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
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="mb-1 text-sm font-medium text-slate-500">As-Is</h2>
                <p className="whitespace-pre-wrap text-sm text-slate-900">{r.as_is || '-'}</p>
              </section>
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="mb-1 text-sm font-medium text-slate-500">To-Be</h2>
                <p className="whitespace-pre-wrap text-sm text-slate-900">{r.to_be || '-'}</p>
              </section>
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="mb-1 text-sm font-medium text-slate-500">비고</h2>
                <p className="whitespace-pre-wrap text-sm text-slate-900">{r.note || '-'}</p>
              </section>
            </>
          )}

          <RequirementLinks requirementId={id} brandId={requirementBrandId} />

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-medium text-slate-500">이미지</h2>
            {images.length === 0 && <p className="text-sm text-slate-400">첨부된 이미지가 없습니다.</p>}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((img) => (
                <div key={img.id} className="relative">
                  <a href={img.signedUrl} target="_blank" rel="noreferrer">
                    <img
                      src={img.signedUrl}
                      alt=""
                      className="h-20 w-full rounded-md border border-slate-200 object-cover"
                    />
                  </a>
                  <button
                    type="button"
                    onClick={() => deleteImage(img.id)}
                    className="absolute right-1 top-1 rounded-full bg-slate-900/70 px-1.5 text-xs text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <ImageDropzone
                files={newFiles}
                onAdd={(added) => setNewFiles((prev) => [...prev, ...added])}
                onRemove={(i) => setNewFiles((prev) => prev.filter((_, idx) => idx !== i))}
              />
              {newFiles.length > 0 && (
                <button
                  type="button"
                  onClick={uploadNew}
                  className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
                >
                  {newFiles.length}개 업로드
                </button>
              )}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <div>
            <p className="text-slate-500">상태</p>
            {/* 보드 밖 상태(반려·취소·중복)일 때 BOARD_STATUSES 만 담은 Select 에
                그 값을 넣으면 트리거가 빈 칸이 된다. 뱃지로 보여주고, 재개는
                별도 Select 로 분리한다 — "지금 반려 상태"와 "어디로 되돌릴까"는
                다른 질문이다. */}
            {isOffBoard ? (
              <div className="mt-1 flex flex-col gap-1">
                <Badge className={`w-fit ${statusStyle(r.status)}`}>{r.status}</Badge>
                {processAllowed && r.status !== MERGED_STATUS && (
                  <Select
                    items={BOARD_STATUSES.map((s) => ({ value: s, label: s }))}
                    value={null}
                    onValueChange={changeStatus}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="재개 — 상태 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {BOARD_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : processAllowed ? (
              <Select
                items={BOARD_STATUSES.map((s) => ({ value: s, label: s }))}
                value={r.status}
                onValueChange={changeStatus}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOARD_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="font-medium text-slate-900">{r.status}</p>
            )}

            {/* 위 상태 Select 는 3차 이상에게만 보인다. 그런데 승인은 4차도 할
                수 있어야 하므로, 이 버튼이 없으면 요청한 브랜드 담당자가 자기
                건을 확인할 방법이 아예 없다. 3차 이상에게도 함께 보여준다 —
                승인대기에서 할 일은 Select 를 뒤지는 게 아니라 이 버튼이다. */}
            {r.status === APPROVAL_PENDING_STATUS &&
              canApprove({
                requirement: { status: r.status, assignee: r.assignee?.id ?? null },
                actor: { memberId: identity.memberId, isGlobalAdmin: isGlobalAdmin(identity) },
              }).allowed && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setApprovalOpen(true)}
                    className="w-full rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
                  >
                    승인하고 완료
                  </button>
                  <p className="mt-1 text-xs text-slate-500">
                    무엇을 확인했는지 적으면 완료로 넘어갑니다.
                  </p>
                </div>
              )}
            {/* 4차 요청자에게 보이는 유일한 제출 수단이다. 3차 이상은 위 Select
                로 바로 옮길 수 있으므로 중복해서 보여주지 않는다.
                이 버튼이 없던 동안 4차가 올린 건은 '작성중'에 머물렀고,
                올린 사람은 접수됐다고 믿었다. */}
            {!processAllowed &&
              canSubmitForReview(
                { status: r.status, requester: r.requester?.id },
                { memberId: identity.memberId, tier: identity.tier, isGlobalAdmin: false },
              ) && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={submitForReview}
                    className="w-full rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
                  >
                    검토 요청
                  </button>
                  <p className="mt-1 text-xs text-slate-500">
                    누르면 IT 담당자에게 전달되고 상태가 검토대기로 바뀝니다.
                  </p>
                </div>
              )}
          </div>
          {canClose && (
            <CloseActions
              canReject={processAllowed}
              onClose={closeRequirement}
            />
          )}
          <div>
            <p className="text-slate-500">담당자</p>
            {processAllowed ? (
              <Select
                items={[
                  { value: '__none__', label: '미지정' },
                  ...teamMembers.map((m) => ({ value: m.id, label: m.name })),
                ]}
                value={r.assignee?.id ?? '__none__'}
                onValueChange={changeAssignee}
              >
                <SelectTrigger className="mt-1 w-full">
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
              <p className="font-medium text-slate-900">{r.assignee?.name ?? '미지정'}</p>
            )}
          </div>
          <div>
            <p className="text-slate-500">프로젝트</p>
            {processAllowed ? (
              <Select
                items={[
                  { value: 'none', label: '선택 안 함' },
                  ...projects.map((p) => ({ value: p.id, label: p.name })),
                ]}
                value={r.project_id ?? 'none'}
                onValueChange={changeProject}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">선택 안 함</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : r.project ? (
              <Link
                href={`/projects/${r.project.id}`}
                className="font-medium text-indigo-600 hover:underline"
              >
                {r.project.name}
              </Link>
            ) : (
              <p className="font-medium text-slate-900">-</p>
            )}
          </div>
          {/* 배포예상일은 IT가 정한다(API 도 3차 이상만 허용). 4차에게 입력칸을
              보여주면 눌러놓고 403 을 받게 되므로 값만 보여준다. */}
          <ExpectedDateField
            key={r.expected_release_date ?? '__none__'}
            value={r.expected_release_date}
            overdue={isOverdue(r.expected_release_date, r.status, today)}
            editable={processAllowed}
            onSave={changeExpectedDate}
          />
          {/* 여기부터는 읽기 전용이다. 위쪽 컨트롤들과 섞여 있으면 "왜 이건
              안 바뀌지?"로 읽히므로 선을 긋고 제목을 달아 갈라 둔다.
              내용을 고치려면 상단의 '수정'을 눌러야 한다. */}
          <div className="mt-1 border-t border-slate-200 pt-3">
            <p className="mb-2 text-xs text-slate-400">요청 내용 · 수정에서 변경</p>
            <div className="flex flex-col gap-3">
              <MetaRow label="카테고리" value={r.category?.category_name ?? '미분류'} />
              {/* 0009 이전에 만들어진 건은 channel 이 비어 있다. 수정에서 채워진다. */}
              <MetaRow label="채널" value={r.channel ?? '미지정'} />
              <MetaRow label="우선순위" value={r.priority ?? '미지정'} />
              <MetaRow label="요청자" value={r.requester?.name ?? '-'} />
              <MetaRow label="요청일" value={r.request_date ?? '-'} />
            </div>
          </div>
          {r.is_confidential && <p className="text-rose-600">비공개</p>}
        </aside>
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

      <StatusDurations durations={statusDurations} />

      <ChecklistSection
        requirementId={id}
        brandId={requirementBrandId}
        canManage={processAllowed}
      />

      {/* 상태 이력과 코멘트를 한 줄기로 보여준다. 이력은 상세 API 가 이미
          내려주고, 코멘트는 자기 엔드포인트에서 따로 불러와 화면에서 섞는다. */}
      <ActivityFeed
        requirementId={id}
        brandId={requirementBrandId}
        history={history}
        memberId={identity.memberId}
      />

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

// 종결 버튼 + 사유 입력.
//
// 사유를 필수로 받는 것이 이 UI의 존재 이유다. window.prompt 로도 되지만
// 취소·재입력이 어렵고 긴 문장을 쓰기 나쁘다 — 한 달 뒤에 읽을 기록이므로
// 제대로 쓸 자리를 준다.
//
// props: canReject(3차 이상인가), onClose(status, reason) => Promise<boolean>
function CloseActions({ canReject, onClose }) {
  const [target, setTarget] = useState(null); // null | '반려' | '취소'
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function start(status) {
    setTarget(status);
    setReason('');
  }

  async function submit(event) {
    event.preventDefault();
    if (!reason.trim()) return;
    setSubmitting(true);
    const ok = await onClose(target, reason);
    setSubmitting(false);
    if (ok) {
      setTarget(null);
      setReason('');
    }
  }

  if (!target) {
    return (
      <div className="flex gap-2 border-t border-slate-100 pt-3">
        {/* 반려는 IT의 결정이라 3차 이상에게만 보인다. 취소는 요청한 쪽이
            거두는 것이라 이 화면을 볼 수 있는 사람이면 누구나 할 수 있다. */}
        {canReject && (
          <button
            type="button"
            onClick={() => start(REJECTED_STATUS)}
            className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50"
          >
            반려
          </button>
        )}
        <button
          type="button"
          onClick={() => start(CANCELLED_STATUS)}
          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          취소
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-t border-slate-100 pt-3">
      <label htmlFor="close-reason" className="text-xs text-slate-500">
        {target === REJECTED_STATUS ? '반려 사유' : '취소 사유'} (필수)
      </label>
      <textarea
        id="close-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        required
        className="rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-400 focus:outline-none"
        placeholder={
          target === REJECTED_STATUS
            ? '왜 진행하지 않기로 했는지 적어 주세요.'
            : '왜 거두는지 적어 주세요.'
        }
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setTarget(null)}
          disabled={submitting}
          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          되돌리기
        </button>
        <button
          type="submit"
          disabled={submitting || !reason.trim()}
          className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs text-white disabled:opacity-40"
        >
          {submitting ? '처리 중...' : `${target} 처리`}
        </button>
      </div>
    </form>
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

  if (!editable) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-slate-500">배포예상일</span>
        <span className={overdue ? 'font-medium text-rose-600' : 'font-medium text-slate-900'}>
          {value ? (overdue ? `⚠ ${value} 지연` : value) : '-'}
        </span>
      </div>
    );
  }

  return (
    <div>
      <p className="text-slate-500">배포예상일</p>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="date"
          aria-label="배포예상일"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-indigo-400 focus:outline-none"
        />
        {dirty && (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="shrink-0 rounded-lg bg-slate-900 px-2.5 py-1 text-xs text-white disabled:opacity-40"
          >
            {saving ? '...' : draft ? '저장' : '해제'}
          </button>
        )}
      </div>
      {overdue && !dirty && <p className="mt-1 text-xs font-medium text-rose-600">⚠ 예상일이 지났습니다</p>}
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
