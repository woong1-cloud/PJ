'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseBrowser';
import { saveIdentity } from '@/lib/identity';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BrandHeader } from '@/components/BrandHeader';

export default function LoginPage() {
  const router = useRouter();
  // 'checking' | 'credentials' | 'brand' | 'no-brand'
  const [step, setStep] = useState('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [me, setMe] = useState(null);
  const [brands, setBrands] = useState([]);
  const [brandId, setBrandId] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me')
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (cancelled) return;
        if (!res.ok) {
          setStep('credentials');
          return;
        }
        resolveAfterAuth(data);
      })
      .catch(() => {
        if (!cancelled) setStep('credentials');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resolveAfterAuth(meData) {
    if (meData.mustChangePassword) {
      router.push('/change-password');
      return;
    }
    try {
      const brandsRes = await fetch('/api/my-brands');
      const brandsData = await brandsRes.json();
      if (!brandsRes.ok) throw new Error(brandsData.error ?? '브랜드 목록을 불러오지 못했습니다.');
      if (!mountedRef.current) return;

      const list = brandsData.brands ?? [];
      if (list.length === 0) {
        setMe(meData);
        setStep('no-brand');
        return;
      }
      if (list.length === 1) {
        enterBrand(meData, list[0]);
        return;
      }
      setMe(meData);
      setBrands(list);
      setStep('brand');
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err.message);
      setStep('credentials');
    }
  }

  function enterBrand(meData, brand) {
    if (!mountedRef.current) return;
    saveIdentity({
      memberId: meData.memberId,
      name: meData.name,
      isGlobalAdmin: meData.isGlobalAdmin,
      brandId: brand.id,
      tier: brand.tier,
    });
    router.push('/requirements');
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    if (!mountedRef.current) return;
    setMe(null);
    setStep('credentials');
  }

  async function handleCredentialsSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');

      const meRes = await fetch('/api/me');
      const meData = await meRes.json();
      if (!meRes.ok) throw new Error(meData.error ?? '로그인 처리 중 오류가 발생했습니다.');

      await resolveAfterAuth(meData);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleBrandSubmit(event) {
    event.preventDefault();
    const brand = brands.find((b) => b.id === brandId);
    if (!brand) return;
    enterBrand(me, brand);
  }

  if (step === 'checking') {
    return <div className="p-6 text-sm text-slate-500">불러오는 중...</div>;
  }

  if (step === 'no-brand') {
    // 신청 내용을 함께 보여준다. 기다리는 사람이 가장 먼저 떠올리는 의문이
    // "내가 뭘로 신청했더라"라서다.
    const applied = [
      ['소속', me?.affiliation],
      ['직무', me?.jobRole],
      ['근무 브랜드', me?.requestedBrandName],
    ].filter(([, v]) => v);

    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-base font-medium text-slate-900">배치를 기다리는 중입니다.</p>
          {/* "관리자에게 문의하세요"를 뺐다. 기다리면 되는 상황인데
              사용자가 뭔가 해야 할 것처럼 읽힌다. */}
          <p className="mt-2 text-sm text-slate-600">
            관리자가 브랜드를 배치하면 사용할 수 있습니다.
          </p>
          {applied.length > 0 && (
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-left">
              <p className="text-xs text-slate-500">신청 내용</p>
              <dl className="mt-1 flex flex-col gap-1 text-sm">
                {applied.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="text-slate-700">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 text-sm text-slate-500 underline hover:text-slate-700"
          >
            로그아웃
          </button>
        </div>
      </main>
    );
  }

  if (step === 'brand') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">브랜드 선택</h1>
          <form onSubmit={handleBrandSubmit} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="brand">브랜드</Label>
              <Select
                items={brands.map((b) => ({ value: b.id, label: b.name }))}
                value={brandId || null}
                onValueChange={setBrandId}
                required
              >
                <SelectTrigger id="brand" className="w-full">
                  <SelectValue placeholder="선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 p-2 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              disabled={!brandId}
            >
              입장
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <BrandHeader />
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">로그인</h1>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <form onSubmit={handleCredentialsSubmit} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 p-2 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="text-indigo-600 hover:underline">
            가입하기
          </Link>
        </p>
      </div>
    </main>
  );
}
