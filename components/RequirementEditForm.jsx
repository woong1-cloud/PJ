'use client';

import { useEffect, useRef, useState } from 'react';
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
import { CHANNELS, DEFAULT_CHANNEL } from '@/lib/channels';
import { REQUIREMENT_TYPES } from '@/lib/requirementTypes';

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

// props: requirement(현재 값), canSetConfidential, identity, onSaved(updatedRequirement), onCancel()
export function RequirementEditForm({ requirement, canSetConfidential, identity, onSaved, onCancel }) {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: requirement.title ?? '',
    priority: requirement.priority ?? '',
    category: requirement.category?.id ?? 'none',
    // 0009 이전에 만들어진 건은 channel 이 비어 있다. 기본값으로 채운다.
    channel: requirement.channel ?? DEFAULT_CHANNEL,
    // 0019 이전 건은 null(미분류)이다. 수정 화면에서 채울 수 있게 열어 둔다 —
    // 9건뿐이라 손으로 채우는 편이 임의 분류보다 정확하다.
    requirementType: requirement.requirement_type ?? '',
    asIs: requirement.as_is ?? '',
    toBe: requirement.to_be ?? '',
    note: requirement.note ?? '',
    isConfidential: requirement.is_confidential ?? false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // 화면을 열었을 때의 값. 저장 시 무엇이 바뀌었는지 이것과 비교한다.
  // form 과 같은 모양으로 한 번만 잡아 둔다(리렌더에 흔들리지 않게 ref).
  const initialRef = useRef({
    title: requirement.title ?? '',
    priority: requirement.priority ?? null,
    category: requirement.category?.id ?? null,
    channel: requirement.channel ?? DEFAULT_CHANNEL,
    requirementType: requirement.requirement_type ?? null,
    asIs: requirement.as_is ?? '',
    toBe: requirement.to_be ?? '',
    note: requirement.note ?? '',
    isConfidential: requirement.is_confidential ?? false,
  });

  useEffect(() => {
    fetch(`/api/brand-categories?brandId=${identity.brandId}`)
      .then((res) => res.json())
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => {});
  }, [identity.brandId]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      // 바뀐 필드만 보낸다.
      //
      // 예전에는 매번 전부 보냈는데, 서버는 undefined 가 아닌 값을 "바뀐 것"으로
      // 보고 change_logs 에 적는다. 그래서 유형 하나만 고쳐도 활동 이력에
      // "제목, 우선순위, 카테고리, 채널, 유형, As-Is, To-Be, 비고 수정" 이
      // 남았다. 이력이 그런 식이면 나중에 아무도 읽지 않는다.
      //
      // 여는 시점의 값(initial)과 비교한다. 서버에 다시 묻지 않는 이유는,
      // 여기서 알고 싶은 것이 "이 사람이 이 화면에서 무엇을 건드렸나"이기
      // 때문이다.
      const next = {
        title: form.title,
        priority: form.priority || null,
        category: form.category === 'none' ? null : form.category,
        channel: form.channel,
        requirementType: form.requirementType || null,
        asIs: form.asIs,
        toBe: form.toBe,
        note: form.note,
        isConfidential: form.isConfidential,
      };
      const patch = { brandId: identity.brandId };
      for (const [key, value] of Object.entries(next)) {
        if (value !== initialRef.current[key]) patch[key] = value;
      }

      // 아무것도 안 바꾸고 저장을 누르면 서버가 '수정할 필드가 없습니다' 로
      // 400 을 낸다. 그건 오류가 아니라 아무 일도 없는 것이므로 그냥 닫는다.
      if (Object.keys(patch).length === 1) {
        onCancel();
        return;
      }

      const res = await fetch(`/api/requirements/${requirement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '수정에 실패했습니다.');
      onSaved(data.requirement);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-indigo-200 bg-indigo-50/30 p-4"
    >
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-title">제목</Label>
        <Input id="edit-title" value={form.title} onChange={(e) => updateField('title', e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="edit-priority">우선순위</Label>
          <LevelSelect id="edit-priority" value={form.priority} onChange={(v) => updateField('priority', v)} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-category">카테고리</Label>
        <Select
          items={[
            { value: 'none', label: '선택 안 함' },
            ...categories.map((c) => ({ value: c.id, label: c.category_name })),
          ]}
          value={form.category}
          onValueChange={(value) => updateField('category', value)}
        >
          <SelectTrigger id="edit-category" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">선택 안 함</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.category_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-type">유형</Label>
        <Select
          items={REQUIREMENT_TYPES.map((t) => ({ value: t, label: t }))}
          value={form.requirementType || null}
          onValueChange={(value) => updateField('requirementType', value)}
        >
          <SelectTrigger id="edit-type" className="w-full">
            <SelectValue placeholder="미분류" />
          </SelectTrigger>
          <SelectContent>
            {REQUIREMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-channel">채널</Label>
        <Select
          items={CHANNELS.map((c) => ({ value: c, label: c }))}
          value={form.channel}
          onValueChange={(value) => updateField('channel', value)}
        >
          <SelectTrigger id="edit-channel" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNELS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-asIs">As-Is</Label>
        <Textarea id="edit-asIs" value={form.asIs} onChange={(e) => updateField('asIs', e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-toBe">To-Be</Label>
        <Textarea id="edit-toBe" value={form.toBe} onChange={(e) => updateField('toBe', e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-note">비고</Label>
        <Textarea id="edit-note" value={form.note} onChange={(e) => updateField('note', e.target.value)} />
      </div>
      {canSetConfidential && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="edit-isConfidential"
            checked={form.isConfidential}
            onCheckedChange={(checked) => updateField('isConfidential', Boolean(checked))}
          />
          <Label htmlFor="edit-isConfidential">비공개 요구사항 (브랜드 관리자 이상만 조회 가능)</Label>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          취소
        </Button>
        <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700">
          {submitting ? '저장 중...' : '저장'}
        </Button>
      </div>
    </form>
  );
}
