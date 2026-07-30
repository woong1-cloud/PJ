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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// props: open, onOpenChange, project(수정 대상 또는 null), teamMembers[], onSaved()
export function ProjectFormDialog({ open, onOpenChange, project, teamMembers, onSaved }) {
  const mode = project ? 'edit' : 'create';
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('none');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 다이얼로그가 열리는 렌더에서 폼을 대상 값으로 맞춘다(useEffect 대신 파생 상태).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(project?.name ?? '');
      setDescription(project?.description ?? '');
      setOwner(project?.owner?.id ?? 'none');
      setStartDate(project?.start_date ?? '');
      setTargetDate(project?.target_date ?? '');
      setError('');
    }
  }

  // 저장을 눌러 서버에 다녀오기 전에 알려준다. 날짜 두 칸은 눈으로 봐서
  // 뒤집힌 걸 알기 어렵다 — 8월 31일과 7월 1일이 나란히 있으면 그냥 두 날짜다.
  const dateOrderBroken = Boolean(startDate && targetDate && startDate > targetDate);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const url = mode === 'create' ? '/api/projects' : `/api/projects/${project.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          owner: owner === 'none' ? null : owner,
          // 빈 문자열을 그대로 보낸다. 서버가 '' 를 null(비우기)로 읽는다 —
          // 여기서 미리 null 로 바꾸면 "안 보냄"과 구별이 안 된다.
          startDate,
          targetDate,
        }),
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

  const ownerItems = [
    { value: 'none', label: '지정 안 함' },
    ...teamMembers.map((m) => ({ value: m.id, label: m.name })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '새 프로젝트' : '프로젝트 수정'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-sm">
          {error && <p className="text-red-600">{error}</p>}
          <div className="flex flex-col gap-1">
            <Label htmlFor="project-name">프로젝트 이름</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="project-description">설명</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="project-owner">총괄 담당자</Label>
            <Select items={ownerItems} value={owner} onValueChange={setOwner}>
              <SelectTrigger id="project-owner" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ownerItems.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* 로드맵의 가로축이 이 두 칸에서 나온다. 둘 다 비워 두면 그 프로젝트는
              로드맵에서 '기간 미정'으로 빠지므로, 그 사실을 여기서 알려 준다. */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="project-start">시작일</Label>
              <Input
                id="project-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="project-target">목표일</Label>
              <Input
                id="project-target"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>
          {dateOrderBroken ? (
            <p className="text-xs text-red-600">목표일이 시작일보다 앞설 수 없습니다.</p>
          ) : (
            <p className="text-xs text-slate-500">
              {startDate && targetDate
                ? '로드맵에 기간 막대로 표시됩니다.'
                : startDate || targetDate
                  ? '한쪽만 정해져 있어 로드맵에 마일스톤 한 점으로 표시됩니다.'
                  : '비워 두면 로드맵의 "기간 미정"에 들어갑니다.'}
            </p>
          )}
          <DialogFooter>
            <Button
              type="submit"
              disabled={submitting || dateOrderBroken}
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
