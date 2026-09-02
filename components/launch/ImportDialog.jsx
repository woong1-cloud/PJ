'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { parseWorkbook } from '@/lib/launchImport';
import { parseRoles } from '@/lib/launchRoles';

// 체크리스트 엑셀을 가이드로 가져온다.
//
// 파일을 서버에 올리지 않는다. 브라우저에서 읽어 JSON 만 보내므로 저장소도
// 업로드 배관도 필요 없다. 대신 서버가 같은 함수로 다시 검증한다 — 화면이
// 보낸 것을 믿지 않는다.
//
// xlsx 는 이 창을 열 때만 받는다(동적 import). 1MB 짜리라 다른 화면이 이것
// 때문에 무거워지면 안 된다.
//
// 403건이 확인 없이 그냥 들어가면 무섭다. 읽은 것을 먼저 보여주고 사람이 누른다.
export function ImportDialog({ open, guideId, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  function close() {
    onClose();
    setFile(null);
    setPreview(null);
    setError('');
  }

  async function read(picked) {
    if (!picked) return;
    setFile(picked);
    setPreview(null);
    setError('');
    setReading(true);
    try {
      // 여기서만 받는다. 다른 화면의 번들에 들어가지 않는다.
      const XLSX = await import('xlsx');
      const buf = await picked.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });

      // header: 1 로 배열 행을 받는다. 머리 행의 위치를 가정하지 않기
      // 위해서다 — 24_R&R분배 는 1행이 제목이고 2행이 머리다.
      const sheets = wb.SheetNames.map((name) => ({
        name,
        rows: XLSX.utils.sheet_to_json(wb.Sheets[name], {
          header: 1,
          defval: null,
          blankrows: true,
        }),
      }));

      const parsed = parseWorkbook(sheets);
      const roleSheet = sheets.find((s) => /^24_/.test(s.name));
      const roles = parseRoles(roleSheet?.rows ?? []);

      if (parsed.items.length === 0) {
        setError(
          '읽을 항목이 없습니다. 워크스트림 시트(01~18)와 머리 행(ID · 체크 항목 · D-day)이 있는지 확인해 주세요.',
        );
      }
      setPreview({ ...parsed, roles, sheetCount: sheets.length });
    } catch (err) {
      setError(`파일을 읽지 못했습니다. ${err?.message ?? ''}`);
    } finally {
      setReading(false);
    }
  }

  async function submit() {
    if (!preview?.items?.length) return;
    setSaving(true);
    setError('');
    const res = await fetch(`/api/launch/guides/${guideId}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: preview.items,
        roles: preview.roles,
        sourceVersion: file?.name ?? null,
      }),
    }).catch(() => null);
    setSaving(false);

    if (!res?.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? '가져오지 못했습니다.');
      return;
    }
    const body = await res.json();
    onDone?.(body);
    close();
  }

  if (!open) return null;

  const ws = preview
    ? [...new Set(preview.items.map((i) => i.workstream))].sort()
    : [];

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !saving) close();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>엑셀에서 항목 가져오기</DialogTitle>
          <DialogDescription>
            같은 파일을 여러 번 올려도 됩니다. <b>정의만 갱신하고 진행 상태는 그대로</b> 둡니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600">
            {file ? file.name : 'xlsx 파일을 고르세요'}
            <input
              type="file"
              accept=".xlsx,.xlsm,.csv"
              onChange={(e) => read(e.target.files?.[0])}
              className="hidden"
            />
          </label>

          {reading && <p className="text-sm text-slate-500">읽는 중...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {preview && preview.items.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p>
                항목 <b className="tabular-nums">{preview.items.length}</b>건 · 워크스트림{' '}
                <b className="tabular-nums">{ws.length}</b>개 · 역할{' '}
                <b className="tabular-nums">{preview.roles.length}</b>종
              </p>
              <p className="text-xs text-slate-500">
                ★ {preview.items.filter((i) => i.is_critical).length} · 선행조건{' '}
                {preview.items.filter((i) => i.depends_on?.length).length} · 산출물{' '}
                {preview.items.filter((i) => i.deliverable).length}
              </p>
              {preview.duplicates > 0 && (
                <p className="text-xs text-amber-700">
                  같은 코드가 {preview.duplicates}건 겹쳐 뒤엣것을 씁니다.
                </p>
              )}
              {/* 무엇을 안 읽었는지 보여준다. 파생 시트를 건너뛰는 것이
                  의도인데 말 안 하면 "왜 빠졌지"가 된다. */}
              {preview.skipped.length > 0 && (
                <p className="text-xs text-slate-400">
                  건너뜀 {preview.skipped.length}개 — {preview.skipped.join(', ')}
                </p>
              )}
              <p className="text-[11px] text-slate-400">
                기한 열은 읽지 않습니다. D-day 와 오픈일로 계산합니다.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={saving}>
            그만두기
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={saving || reading || !preview?.items?.length}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {saving ? '가져오는 중...' : '가져오기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
