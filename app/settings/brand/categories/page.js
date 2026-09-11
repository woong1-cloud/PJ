'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useIdentity } from '@/components/IdentityProvider';
import { canManageBrand } from '@/lib/tiers';
import { CategorySettings } from '@/components/CategorySettings';

// 이 브랜드의 분류.
//
// 팀 배치와 갈라 놓은 이유는 team/page.js 주석에 있다. 문지기·불러오기 실패
// 처리·reloadToken 새로고침은 원본(/requirements/settings)에서 그대로 왔다.
export default function BrandCategoriesPage() {
  const { identity } = useIdentity();
  const router = useRouter();
  const manageBrand = canManageBrand(identity);

  const [categories, setCategories] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!manageBrand) router.replace('/requirements');
  }, [manageBrand, router]);

  useEffect(() => {
    if (!manageBrand) return undefined;
    let cancelled = false;
    fetch(`/api/brand-categories?brandId=${identity.brandId}`)
      .then((res) => res.json().then((d) => ({ res, d })))
      .then(({ res, d }) => {
        if (cancelled) return;
        if (!res.ok) throw new Error(d.error ?? '카테고리를 불러오지 못했습니다.');
        setCategories(d.categories ?? []);
        setLoadError('');
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [manageBrand, identity.brandId, reloadToken]);

  function refresh() {
    setReloadToken((t) => t + 1);
  }

  if (!manageBrand) {
    return <p className="text-sm text-slate-500">권한이 없습니다. 목록으로 이동합니다...</p>;
  }
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;

  return <CategorySettings categories={categories} identity={identity} onChanged={refresh} />;
}
