import { IdentityProvider } from '@/components/IdentityProvider';
import { TopBar } from '@/components/TopBar';
import { SettingsRail } from '@/components/settings/SettingsRail';

// 설정은 한 입구다.
//
// 예전에는 브랜드 관리·팀원 관리·받은 의견이 계정 메뉴에도 있고 관리 화면의
// 탭으로도 있었다. 같은 곳으로 가는 길이 둘이었고, 「브랜드 설정」과
// 「브랜드 관리」는 다른 화면인데 메뉴에서 네 줄 떨어져 있었다.
// 레일로 묶음을 보이면 자리가 이름을 설명한다.
export default function SettingsLayout({ children }) {
  return (
    <IdentityProvider>
      <div className="min-h-screen bg-slate-50 print:bg-white">
        {/* 인쇄에서 상단바를 뺀다. 「폰에 설치하기」가 이 아래로 들어오는데
            그 화면은 종이로 나눠 주려고 인쇄한다 — 그때 필요한 건 QR 과
            순서뿐이다. 지금 app/install/layout.js 가 하던 일을 여기서
            이어받는다(다음 작업에서 그 파일이 없어진다). */}
        <div className="print:hidden">
          <TopBar />
        </div>
        <main className="p-4">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
            <div className="print:hidden">
              <SettingsRail />
            </div>
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        </main>
      </div>
    </IdentityProvider>
  );
}
