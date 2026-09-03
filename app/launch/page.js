'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useIdentity } from '@/components/IdentityProvider';
import { isGlobalAdmin } from '@/lib/tiers';
import { LaunchList } from '@/components/launch/LaunchList';
import { NewLaunchDialog } from '@/components/launch/NewLaunchDialog';
import { Button } from '@/components/ui/button';

// 런칭 목록 — 이 구역의 입구.
//
// beta 동안은 전체 관리자만 본다. 화면 게이팅은 편의일 뿐이고 관문은
// API 다(requireGlobalAdmin).
export default function LaunchPage() {
  const { identity } = useIdentity();
  const admin = isGlobalAdmin(identity);

  const [launches, setLaunches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  // 만든 뒤 다시 부르는 손잡이. effect 밖의 함수를 effect 에서 부르면 그 안의
  // setState 가 동기 호출로 보여 cascading render 경고가 난다.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!admin) return undefined;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/launch');
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? '불러오지 못했습니다.');
        if (cancelled) return;
        setLaunches(body.launches ?? []);
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
            런칭
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-normal text-slate-500">
              beta
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            브랜드 하나의 오픈 준비입니다. 가이드에서 항목을 복사해 시작합니다.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/launch/guide"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            가이드
          </Link>
          <Button
            type="button"
            onClick={() => setNewOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            ＋ 런칭
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">불러오는 중...</p>}

      {!loading && <LaunchList launches={launches} onOpenNew={() => setNewOpen(true)} />}

      <NewLaunchDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={() => setReloadToken((t) => t + 1)}
      />
    </div>
  );
}
