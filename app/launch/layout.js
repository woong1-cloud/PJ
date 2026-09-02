import { IdentityProvider } from '@/components/IdentityProvider';
import { TopBar } from '@/components/TopBar';

// meeting·projects·admin·help 와 같은 모양이다. 최상위 구역마다
// IdentityProvider 를 따로 감싸는 것이 이 앱의 방식이라 그대로 따른다 —
// 이 레이아웃이 없으면 빌드 중 프리렌더에서 useIdentity 가 던진다.
export default function LaunchLayout({ children }) {
  return (
    <IdentityProvider>
      <div className="min-h-screen bg-slate-50">
        <TopBar />
        <main className="p-4">{children}</main>
      </div>
    </IdentityProvider>
  );
}
