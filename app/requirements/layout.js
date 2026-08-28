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
        {/* 소식 팝업은 여기 없다. 헤더의 NewsMenu 가 아이콘의 점과 같은
            상태를 보고 띄운다 — 나누면 팝업에서 확인을 눌러도 점이 안
            사라진다. TopBar 가 모든 화면에 있으므로 팝업도 어디서든 뜬다. */}
      </div>
    </IdentityProvider>
  );
}
