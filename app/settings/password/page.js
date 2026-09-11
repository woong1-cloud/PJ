'use client';

import { useState } from 'react';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';

// 설정 안의 비밀번호 바꾸기.
//
// 폼은 /change-password 와 같은 부품이다. 다른 것은 성공한 뒤뿐이다 —
// 저기는 첫 로그인의 관문이라 /login 으로 보내지만, 여기는 그냥 설정 화면이라
// 바꿨다고 알리고 그 자리에 머문다. 설정 한 줄을 고쳤다고 로그인 화면으로
// 쫓아내면 하던 일이 끊긴다.
export default function SettingsPasswordPage() {
  const [done, setDone] = useState(false);

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-lg font-semibold text-slate-900">비밀번호 변경</h1>
      <p className="mt-1 text-sm text-slate-500">8자 이상으로 정하세요.</p>
      {done && (
        <p className="mt-3 rounded-md bg-emerald-50 px-2 py-1.5 text-sm text-emerald-800">
          비밀번호를 바꿨습니다.
        </p>
      )}
      <ChangePasswordForm onSuccess={() => setDone(true)} />
    </div>
  );
}
