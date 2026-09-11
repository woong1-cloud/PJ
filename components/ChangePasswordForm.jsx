'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabaseBrowser';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// 비밀번호를 바꾸는 폼. 두 화면이 함께 쓴다.
//
// /change-password 는 첫 로그인 흐름이다 — 임시 비밀번호를 못 쓰게 만드는
// 관문이라 로그인 전에도 열려야 하고(middleware 의 PUBLIC_PATHS), 그래서 그
// 주소는 설정 아래로 옮기지 않았다. /settings/password 는 그냥 설정 화면이다.
//
// 두 화면이 다른 것은 성공한 뒤뿐이다. 첫 로그인 쪽은 /login 으로 보내고,
// 설정 쪽은 그 자리에 머문다. 그 한 가지만 onSuccess 로 가른다 — 8자 검사 ·
// 일치 검사 · updateUser · /api/me/password-changed 는 둘이 같아야 한다.
// 규칙을 양쪽에 베껴 두면 언젠가 한쪽만 고친다.
export function ChangePasswordForm({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error(updateError.message);

      const res = await fetch('/api/me/password-changed', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '처리 중 오류가 발생했습니다.');

      if (!mountedRef.current) return;
      // 칸을 비운다. 설정 화면은 성공한 뒤에도 이 폼이 그대로 떠 있어서,
      // 안 비우면 방금 정한 비밀번호가 칸에 남는다. 첫 로그인 흐름은 곧장
      // /login 으로 떠나므로 보이지도 않는다.
      setPassword('');
      setConfirmPassword('');
      onSuccess();
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err.message);
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  return (
    <>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="new-password">새 비밀번호</Label>
          <Input
            className="h-11 md:h-8"
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="confirm-password">새 비밀번호 확인</Label>
          <Input
            className="h-11 md:h-8"
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <button
          type="submit"
          className="h-11 rounded-lg bg-indigo-600 px-3 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 md:h-9"
          disabled={submitting}
        >
          {submitting ? '변경 중...' : '비밀번호 변경'}
        </button>
      </form>
    </>
  );
}
