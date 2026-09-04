'use client';

import { useEffect, useState } from 'react';
import { useIdentity } from '@/components/IdentityProvider';
import { isGlobalAdmin } from '@/lib/tiers';
import { GuideView } from '@/components/launch/GuideView';
import { ImportDialog } from '@/components/launch/ImportDialog';
import { GuideItemDialog } from '@/components/launch/GuideItemDialog';
import { Button } from '@/components/ui/button';

// 런칭 가이드 화면.
//
// 1단계에서는 전체 관리자만 본다. 가이드와 가져오기뿐이라 참여자가 할 일이
// 아직 없다 — 참여자는 런칭 보드(1-C)가 생기면 들어온다.
//
// 화면 게이팅은 편의일 뿐이고 관문은 API 다(requireGlobalAdmin).
export default function LaunchGuidePage() {
  const { identity } = useIdentity();
  const admin = isGlobalAdmin(identity);

  const [guide, setGuide] = useState(null);
  const [items, setItems] = useState([]);
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [done, setDone] = useState(null);
  // 가져오기 뒤에 다시 부르는 손잡이. useQuickFilterCounts 와 같은 방식이다 —
  // effect 밖의 useCallback 을 effect 에서 부르면 그 안의 setState 가 동기
  // 호출로 보여 cascading render 경고가 난다.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    // 전체 관리자가 아니면 아무것도 안 부른다. loading 을 여기서 끄지
    // 않는 이유는 아래에서 그보다 먼저 안내 문구로 빠지기 때문이다 —
    // effect 안에서 동기로 setState 하면 렌더가 한 번 더 돈다.
    if (!admin) return undefined;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/launch/guides');
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? '불러오지 못했습니다.');

        // 가이드가 없으면 하나 만든다. 빈 화면에서 "먼저 가이드를 만드세요"를
        // 시키면 그것부터가 뭔지 모른다 — 지금은 종류가 하나뿐이라 물을 것도 없다.
        let first = (body.guides ?? [])[0];
        if (!first) {
          const created = await fetch('/api/launch/guides', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: '신규 브랜드 온라인 오픈',
              description: '브랜드와 무관한 지식. 런칭은 여기서 복제해 시작합니다.',
            }),
          });
          const cb = await created.json();
          if (!created.ok) throw new Error(cb.error ?? '가이드를 만들지 못했습니다.');
          first = cb.guide;
        }

        const detail = await fetch(`/api/launch/guides/${first.id}/items`);
        const db = await detail.json();
        if (!detail.ok) throw new Error(db.error ?? '항목을 불러오지 못했습니다.');

        if (cancelled) return;
        setGuide(db.guide);
        setItems(db.items ?? []);
        setRoles(db.roles ?? []);
        setError('');
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [admin, reloadToken]);

  if (!admin) {
    return <p className="text-sm text-slate-500">전체 관리자만 볼 수 있는 화면입니다.</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h1 className="flex items-baseline gap-2 text-lg font-semibold text-slate-900">
            {guide?.name ?? '런칭 가이드'}
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-normal text-slate-500">
              beta
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            브랜드와 무관한 지식입니다. 런칭이 끝날 때마다 자랍니다.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
            엑셀에서 가져오기
          </Button>
          {/* 주 버튼이 '＋ 항목'이다. 가져오기는 한 번 하고 마는 일이지만
              항목을 더하는 것은 계속 일어난다 — 런칭 중에 빠진 것을 발견하면
              그 자리에서 넣는다. */}
          <Button
            type="button"
            onClick={() => setAddOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            ＋ 항목
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          새로 {done.created}건 · 갱신 {done.updated}건 · 역할 {done.roles}종을 가져왔습니다.
          {done.missing?.length > 0 &&
            ` 시트에 없는 ${done.missing.length}건은 그대로 두었습니다.`}
        </p>
      )}
      {loading && <p className="text-sm text-slate-500">불러오는 중...</p>}

      {!loading && (
        <GuideView
          guide={guide}
          items={items}
          roles={roles}
          onDeleted={() => setReloadToken((t) => t + 1)}
        />
      )}

      <GuideItemDialog
        open={addOpen}
        guideId={guide?.id}
        workstreams={[...new Set(items.map((i) => i.workstream))].sort()}
        roles={roles}
        existing={items}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          setDone(null);
          setReloadToken((t) => t + 1);
        }}
      />

      <ImportDialog
        open={importOpen}
        target={{ kind: 'guide', id: guide?.id }}
        onClose={() => setImportOpen(false)}
        onDone={(body) => {
          setDone(body);
          setReloadToken((t) => t + 1);
        }}
      />
    </div>
  );
}
