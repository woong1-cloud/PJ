'use client';

import { useRouter } from 'next/navigation';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';

// 첫 로그인 흐름의 관문. 임시 비밀번호를 바꿔야 여기를 지난다.
//
// 이 주소는 middleware 의 PUBLIC_PATHS 에 있어서 로그인 전에도 열린다.
// 그래서 설정(/settings/password) 아래로 옮기지 않았다 — 옮기면 비밀번호를
// 바꿔야 로그인이 끝나는 사람이 자기 화면에 못 들어간다.
//
// 폼은 /settings/password 와 같은 것을 쓴다. 여기 남은 것은 껍데기뿐이다.
export default function ChangePasswordPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">비밀번호 변경</h1>
        <p className="mt-1 text-sm text-slate-500">
          임시 비밀번호로는 계속 이용할 수 없습니다. 새 비밀번호를 설정하세요.
        </p>
        {/* 바꾼 뒤 로그인 화면으로 보낸다. 바뀐 비밀번호로 한 번 더 들어와야
            임시 비밀번호가 정말 끝난 것이 된다 — 원래 동작 그대로다. */}
        <ChangePasswordForm onSuccess={() => router.push('/login')} />
      </div>
    </main>
  );
}
