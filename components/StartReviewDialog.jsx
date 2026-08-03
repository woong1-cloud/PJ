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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { REVIEW_IN_PROGRESS_STATUS } from '@/lib/statuses';

// 착수 창 — 검토대기에서 검토중으로 옮길 때 담당자와 예상 배포일을 묻는다.
//
// 이 순간인 이유: 등록 시점에는 브랜드가 두 값을 알 수 없다. IT가 정하는
// 값이고, IT가 그 건을 처음 손대는 순간이 여기다. 실제로 배포 후 데이터를
// 보니 8건 전부 두 값이 비어 있었고, 그래서 지연 판정·로드맵·대시보드가
// 통째로 죽어 있었다.
//
// '나중에 정하기'가 이 창의 핵심이다. 필수로 막으면 급할 때 사람들이 상태를
// 아예 안 옮기고 그냥 일해 버린다 — 그러면 보드가 현실과 어긋나고, 그게 이런
// 툴이 죽는 가장 흔한 방식이다. 막지 않되 기본값을 채우는 쪽으로 둔다.
//
// 새 라우트를 만들지 않는다. 이미 있는 셋을 순서대로 부르고, 상태를 마지막에
// 보낸다 — 앞의 둘이 실패하면 카드가 움직이지 않아서 다시 시도할 수 있다.
// 상태를 먼저 보내면 "옮겨는 갔는데 값은 안 들어간" 상태가 조용히 남는다.
//
// props: open, onOpenChange, requirement({id,title}), brandId, teamMembers, onStarted
export function StartReviewDialog({
  open,
  onOpenChange,
  requirement,
  brandId,
  teamMembers = [],
  onStarted,
}) {
  const [assignee, setAssignee] = useState(null);
  const [expectedDate, setExpectedDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setAssignee(null);
      setExpectedDate('');
      setError('');
    }
  }

  async function send(url, method, body) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error ?? '저장에 실패했습니다.');
    }
  }

  async function start() {
    setSubmitting(true);
    setError('');
    try {
      if (assignee) {
        await send(`/api/requirements/${requirement.id}/assignee`, 'PATCH', {
          brandId,
          assignee,
        });
      }
      if (expectedDate) {
        await send(`/api/requirements/${requirement.id}/expected-date`, 'PATCH', {
          brandId,
          expectedReleaseDate: expectedDate,
        });
      }
      await send(`/api/requirements/${requirement.id}/status`, 'PATCH', {
        brandId,
        status: REVIEW_IN_PROGRESS_STATUS,
      });
      onOpenChange(false);
      onStarted();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>검토 시작</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 break-keep text-sm">
          <p className="text-slate-600">{requirement?.title}</p>

          {error && <p className="text-red-600">{error}</p>}

          <div className="flex flex-col gap-1">
            <label className="text-slate-600" htmlFor="start-assignee">
              담당자
            </label>
            <Select
              items={teamMembers.map((m) => ({ value: m.id, label: m.name }))}
              value={assignee}
              onValueChange={setAssignee}
            >
              <SelectTrigger id="start-assignee" className="w-full">
                <SelectValue placeholder="선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-slate-600" htmlFor="start-date">
              예상 배포일
            </label>
            <input
              id="start-date"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              className="h-9 rounded-lg border border-slate-300 px-3 text-sm focus:border-indigo-400 focus:outline-none"
            />
            <p className="text-xs text-slate-400">
              대략이어도 괜찮습니다. 나중에 바꿀 수 있습니다.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={start}
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {submitting ? '처리 중...' : '검토 시작'}
            </Button>
            {/* 값을 비워 두고도 넘어갈 수 있어야 한다. 위 주석 참조. */}
            <Button type="button" variant="outline" onClick={start} disabled={submitting}>
              나중에 정하기
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
