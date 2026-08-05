import { IdentityProvider } from '@/components/IdentityProvider';
import { TopBar } from '@/components/TopBar';
import { WelcomeDialog } from '@/components/WelcomeDialog';

export default function RequirementsLayout({ children }) {
  return (
    <IdentityProvider>
      <div className="min-h-screen bg-slate-50">
        <TopBar />
        <main className="p-4">{children}</main>
        {/* 첫 로그인 안내. 아직 안 본 사람에게만 뜬다.
            요구사항 영역에만 붙인다 — 로그인 직후 도착하는 곳이 여기이고,
            설명을 읽자마자 시험해 볼 화면도 여기다. */}
        <WelcomeDialog />
      </div>
    </IdentityProvider>
  );
}
