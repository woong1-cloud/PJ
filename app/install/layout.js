import { IdentityProvider } from '@/components/IdentityProvider';
import { TopBar } from '@/components/TopBar';

export default function InstallLayout({ children }) {
  return (
    <IdentityProvider>
      <div className="min-h-screen bg-slate-50 print:bg-white">
        {/* 인쇄물에 상단바가 들어갈 이유가 없다. 이 페이지는 종이로 나눠
            주려고 인쇄한다 — 그때 필요한 건 QR 과 순서뿐이다.
            globals.css 를 안 건드린다. 여기서만 끈다. */}
        <div className="print:hidden">
          <TopBar />
        </div>
        <main className="p-4">{children}</main>
      </div>
    </IdentityProvider>
  );
}
