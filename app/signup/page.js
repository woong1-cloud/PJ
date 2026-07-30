'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AFFILIATIONS, JOB_ROLES } from '@/lib/signup';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [affiliation, setAffiliation] = useState(null);
  const [jobRole, setJobRole] = useState(null);
  const [brandId, setBrandId] = useState(null);
  const [brands, setBrands] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // 소속이 '브랜드'일 때만 근무 브랜드를 묻는다. 본부 소속은 여러 브랜드를
  // 함께 보므로 하나를 고르라는 질문 자체가 성립하지 않는다.
  const needsBrand = affiliation === '브랜드';

  useEffect(() => {
    let cancelled = false;
    fetch('/api/signup/brands')
      .then((res) => res.json().then((d) => ({ res, d })))
      .then(({ res, d }) => {
        if (cancelled || !res.ok) return;
        setBrands(d.brands ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          affiliation,
          jobRole,
          brandId: needsBrand ? brandId : null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? '가입에 실패했습니다.');
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <p className="text-3xl font-semibold tracking-tight text-slate-900">모아 MOA</p>
            <p className="mt-1 text-sm text-slate-500">요구사항과 프로젝트를 한곳에 모읍니다</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-base font-medium text-slate-900">가입이 완료됐습니다.</p>
            <p className="mt-2 text-sm text-slate-600">
              관리자가 브랜드를 배치하면 사용할 수 있습니다.
            </p>
            {/* 이 줄이 없으면 로그인해 보고 고장난 줄 안다. */}
            <p className="mt-1 text-sm text-slate-500">
              배치 전까지는 로그인해도 화면이 보이지 않습니다.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-block text-sm text-indigo-600 hover:underline"
            >
              로그인 화면으로
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const canSubmit =
    name.trim() &&
    email.trim() &&
    password.length >= 8 &&
    affiliation &&
    jobRole &&
    (!needsBrand || brandId);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-3xl font-semibold tracking-tight text-slate-900">모아 MOA</p>
          <p className="mt-1 text-sm text-slate-500">요구사항과 프로젝트를 한곳에 모읍니다</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">가입</h1>
          <p className="mt-1 text-sm text-slate-500">
            가입 후 관리자가 브랜드를 배치하면 사용할 수 있습니다.
          </p>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                required
              />
            </div>
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
              <p className="text-xs text-slate-500">사내 이메일로만 가입할 수 있습니다.</p>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <p className="text-xs text-slate-500">8자 이상</p>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="affiliation">소속</Label>
              <Select
                items={AFFILIATIONS.map((a) => ({ value: a, label: a }))}
                value={affiliation}
                onValueChange={(v) => {
                  setAffiliation(v);
                  // 본부로 바꾸면 고른 브랜드는 보내지 않는다. 화면에서 사라진
                  // 값이 조용히 따라가면 안 된다.
                  if (v !== '브랜드') setBrandId(null);
                }}
              >
                <SelectTrigger id="affiliation" className="w-full">
                  <SelectValue placeholder="선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {AFFILIATIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="jobRole">직무</Label>
              <Select
                items={JOB_ROLES.map((r) => ({ value: r, label: r }))}
                value={jobRole}
                onValueChange={setJobRole}
              >
                <SelectTrigger id="jobRole" className="w-full">
                  <SelectValue placeholder="선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {needsBrand && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="brand">근무 브랜드</Label>
                <Select
                  items={brands.map((b) => ({ value: b.id, label: b.name }))}
                  value={brandId}
                  onValueChange={setBrandId}
                >
                  <SelectTrigger id="brand" className="w-full">
                    <SelectValue placeholder="선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 p-2 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              disabled={submitting || !canSubmit}
            >
              {submitting ? '가입 중...' : '가입'}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-indigo-600 hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
