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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageDropzone } from '@/components/ImageDropzone';
import { CHANNELS, DEFAULT_CHANNEL } from '@/lib/channels';
import { REQUIREMENT_TYPES, TYPE_HINTS } from '@/lib/requirementTypes';

const LEVELS = ['상', '중', '하'];
const LEVEL_STYLE = {
  상: { on: 'border-rose-300 bg-rose-50 text-rose-600', off: 'border-slate-200 text-slate-400 hover:bg-slate-50' },
  중: { on: 'border-amber-300 bg-amber-50 text-amber-700', off: 'border-slate-200 text-slate-400 hover:bg-slate-50' },
  하: { on: 'border-slate-300 bg-slate-100 text-slate-600', off: 'border-slate-200 text-slate-400 hover:bg-slate-50' },
};

function LevelSelect({ id, value, onChange }) {
  return (
    <div id={id} className="flex gap-1.5">
      {LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => onChange(value === level ? '' : level)}
          className={`flex-1 rounded-lg border px-2 py-1.5 text-sm transition-colors ${
            value === level ? LEVEL_STYLE[level].on : LEVEL_STYLE[level].off
          }`}
        >
          {level}
        </button>
      ))}
    </div>
  );
}

function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emptyForm() {
  return {
    title: '',
    priority: '',
    requestDate: todayLocal(),
    category: 'none',
    // 채널은 '선택 안 함'이 없다. 비워두면 채널별 집계에서 그만큼이 샌다.
    channel: DEFAULT_CHANNEL,
    // 유형은 기본값을 두지 않는다. '신규'를 미리 박아 두면 오류 신고까지
    // 신규로 들어오고, 그 순간 이 값은 집계에 쓸 수 없게 된다.
    requirementType: '',
    projectId: 'none',
    asIs: '',
    toBe: '',
    note: '',
    isConfidential: false,
  };
}

export function RequirementFormDialog({ open, onOpenChange, categories, projects = [], identity, onCreated }) {
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [imageFiles, setImageFiles] = useState([]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // 제출 없이(Esc·바깥 클릭·닫기 버튼) 다이얼로그를 닫으면 이전 입력이 다음에 열었을 때
  // 그대로 남아있지 않도록 초기화한다.
  function handleOpenChange(next) {
    if (!next) {
      setForm(emptyForm());
      setImageFiles([]);
      setError('');
    }
    onOpenChange(next);
  }

  // submitForReview: true 면 검토대기로, false 면 작성중(임시저장)으로 만든다.
  //
  // 두 버튼으로 나눈 이유: 예전에는 등록이 무조건 작성중이었고, 4차 요청자는
  // 거기서 검토대기로 올릴 방법이 없었다(상태 변경은 3차 이상). 올린 사람은
  // 접수됐다고 믿고 IT 는 존재를 몰랐다.
  //
  // 그렇다고 등록=제출로만 두면 초안을 잡아 둘 방법이 없어진다 — 이미지를
  // 나중에 붙이거나 내용을 더 다듬으려는 경우가 실제로 있다. 그래서 둘 다 둔다.
  async function handleSubmit(event, submitForReview) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: identity.brandId,
          title: form.title,
          priority: form.priority || null,
          requestDate: form.requestDate,
          category: form.category === 'none' ? null : form.category,
          channel: form.channel,
          requirementType: form.requirementType,
          asIs: form.asIs,
          toBe: form.toBe,
          note: form.note,
          isConfidential: form.isConfidential,
          submit: submitForReview === true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '등록에 실패했습니다.');
      const created = data.requirement;

      // 본문 저장 이후의 부수 작업들은 실패해도 요구사항 자체는 이미 만들어진 상태다.
      // 그래서 예외로 중단하지 않고 경고만 모은다. 하나라도 모이면 다이얼로그를 닫지
      // 않는다 — 닫으면 애니메이션과 함께 메시지가 바로 사라져 사용자가 못 읽는다.
      const warnings = [];

      // 프로젝트 연결은 POST가 아니라 PATCH로 한다 — 전개 대상 브랜드 자동 추가
      // 규칙이 그 라우트에만 있기 때문이다.
      if (form.projectId !== 'none' && created?.id) {
        const linkRes = await fetch(`/api/requirements/${created.id}/project`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: form.projectId }),
        });
        if (!linkRes.ok) {
          const linkData = await linkRes.json();
          // 상세 화면에서 다시 연결할 수 있다.
          warnings.push(`프로젝트 연결에 실패했습니다(${linkData.error ?? ''})`);
        }
      }

      if (imageFiles.length > 0 && created?.id) {
        try {
          const fd = new FormData();
          fd.append('brandId', identity.brandId);
          imageFiles.forEach((f) => fd.append('files', f));
          const imgRes = await fetch(`/api/requirements/${created.id}/images`, {
            method: 'POST',
            body: fd,
          });
          if (!imgRes.ok) {
            const imgData = await imgRes.json();
            throw new Error(imgData.error ?? '이미지 업로드에 실패했습니다.');
          }
        } catch (imgErr) {
          // 상세에서 이미지 재시도 가능.
          warnings.push(`이미지 업로드에 실패했습니다(${imgErr.message})`);
        }
      }

      setForm(emptyForm());
      setImageFiles([]);
      onCreated();
      if (warnings.length > 0) {
        setError(`요구사항은 등록됐지만 ${warnings.join(' / ')}`);
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>새 요구사항 등록</DialogTitle>
        </DialogHeader>
        {/* 엔터 키로 제출될 때도 '검토 요청'이 되게 둔다. 등록하러 들어온
            사람의 기본 의도는 제출이고, 임시저장은 명시적으로 누르는 행동이다. */}
        <form onSubmit={(e) => handleSubmit(e, true)} className="flex flex-col gap-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-col gap-1">
            <Label htmlFor="title">제목</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="priority">우선순위</Label>
              <LevelSelect
                id="priority"
                value={form.priority}
                onChange={(v) => updateField('priority', v)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="requestDate">요청일</Label>
            <Input
              id="requestDate"
              type="date"
              value={form.requestDate}
              onChange={(e) => updateField('requestDate', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="category">카테고리</Label>
            <Select
              items={[
                { value: 'none', label: '선택 안 함' },
                ...categories.map((c) => ({ value: c.id, label: c.category_name })),
              ]}
              value={form.category}
              onValueChange={(value) => updateField('category', value)}
            >
              <SelectTrigger id="category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">선택 안 함</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.category_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="requirementType">유형</Label>
            <Select
              items={REQUIREMENT_TYPES.map((t) => ({ value: t, label: t }))}
              value={form.requirementType || null}
              onValueChange={(value) => updateField('requirementType', value)}
            >
              <SelectTrigger id="requirementType" className="w-full">
                <SelectValue placeholder="선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {REQUIREMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* 등록하는 사람이 늘 판단할 수 있는 값이 아니다. 온라인 MD 입장에서
                "이게 신규 과제인지 기존 개선인지"가 애매한 경우가 실제로 많고,
                그때 억지로 고르게 하면 아무거나 골라 데이터가 더러워진다.
                그래서 필수가 아니고, 그 사실과 네 값의 뜻을 여기서 밝힌다.
                비워 두면 IT 가 검토를 시작할 때 채운다(StartReviewDialog). */}
            {form.requirementType ? (
              <p className="text-xs text-slate-500">{TYPE_HINTS[form.requirementType]}</p>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 break-keep">
                <p className="mb-1 text-slate-600">모르겠으면 비워 두셔도 됩니다 — IT가 검토하며 정합니다.</p>
                <ul className="flex flex-col gap-0.5">
                  {REQUIREMENT_TYPES.map((t) => (
                    <li key={t}>
                      <b className="text-slate-700">{t}</b> · {TYPE_HINTS[t]}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="channel">채널</Label>
            <Select
              items={CHANNELS.map((c) => ({ value: c, label: c }))}
              value={form.channel}
              onValueChange={(value) => updateField('channel', value)}
            >
              <SelectTrigger id="channel" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="projectId">프로젝트</Label>
            <Select
              items={[
                { value: 'none', label: '선택 안 함' },
                ...projects.map((p) => ({ value: p.id, label: p.name })),
              ]}
              value={form.projectId}
              onValueChange={(value) => updateField('projectId', value)}
            >
              <SelectTrigger id="projectId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">선택 안 함</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="asIs">As-Is</Label>
            <Textarea id="asIs" value={form.asIs} onChange={(e) => updateField('asIs', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="toBe">To-Be</Label>
            <Textarea id="toBe" value={form.toBe} onChange={(e) => updateField('toBe', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="note">비고</Label>
            <Textarea id="note" value={form.note} onChange={(e) => updateField('note', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>이미지 첨부</Label>
            <ImageDropzone
              files={imageFiles}
              onAdd={(added) => setImageFiles((prev) => [...prev, ...added])}
              onRemove={(i) => setImageFiles((prev) => prev.filter((_, idx) => idx !== i))}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isConfidential"
              checked={form.isConfidential}
              onCheckedChange={(checked) => updateField('isConfidential', Boolean(checked))}
            />
            <Label htmlFor="isConfidential">비공개 요구사항 (브랜드 관리자 이상만 조회 가능)</Label>
          </div>
          <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
            {/* 무엇이 달라지는지 한 줄로 적어 둔다. 버튼 이름만 보고
                '임시저장'이 남에게 보이는지 아닌지 알 수 없다. */}
            <p className="mr-auto text-xs text-slate-500">
              검토 요청하면 IT 담당자에게 전달됩니다. 임시저장은 나에게만 보입니다.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={(e) => handleSubmit(e, false)}
            >
              {submitting ? '저장 중...' : '임시저장'}
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {submitting ? '요청 중...' : '검토 요청'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
