'use client';

import { useSyncExternalStore } from 'react';

const APP_URL = 'moa.noavibe.app';

const STANDALONE_QUERY = '(display-mode: standalone)';

// 표시 방식은 브라우저가 쥔 값이다 — React 바깥이다.
//
// effect 안에서 setState 로 받아오면 첫 그림 뒤에 한 번 더 그리게 되고,
// lint 의 react-hooks/set-state-in-effect 가 이를 막는다. 이 저장소는
// 같은 문제를 IdentityProvider 에서 useSyncExternalStore 로 풀었다.
// 여기서도 같은 방식을 쓴다.
function subscribeStandalone(onChange) {
  const media = window.matchMedia?.(STANDALONE_QUERY);
  // 낡은 사파리는 addEventListener 가 없다. 그때는 구독을 접는다 —
  // 첫 값은 어차피 아래 스냅샷으로 제대로 읽힌다.
  if (!media?.addEventListener) return () => {};
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

// 불린이라 Object.is 로 그대로 비교된다. lib/identity.js 처럼 값을
// 캐시해 둘 이유가 없다.
function getStandaloneSnapshot() {
  const media = window.matchMedia?.(STANDALONE_QUERY);
  // navigator.standalone 은 iOS 사파리만 준다. 둘 다 본다.
  return Boolean(media?.matches) || window.navigator.standalone === true;
}

// 서버는 이 창이 홈 화면 앱인지 알 길이 없다. 안 깐 것으로 그리고,
// 물이 오른 뒤에 진짜 값으로 바뀐다.
function getServerStandaloneSnapshot() {
  return false;
}

// 홈 화면 앱 안에서 보고 있나.
//
// "지금 이 창"만 안다. PC 브라우저는 그 사람이 폰에 깔았는지 모른다 —
// 그래서 계정 메뉴의 줄은 PC 에서 늘 보인다.
function useStandalone() {
  return useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    getServerStandaloneSnapshot,
  );
}

function Steps({ title, steps }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5">
        {steps.map((step) => (
          <li key={step} className="text-sm break-keep text-slate-600">
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function InstallGuide({ qr }) {
  const standalone = useStandalone();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 break-keep">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">폰에 설치하기</h1>
        <p className="mt-1 text-sm text-slate-500">
          모아를 폰 홈 화면에 앱처럼 둘 수 있습니다. 바로 열리고, 다음 단계에서 알림도 받을 수
          있습니다.
        </p>
      </header>

      {standalone && (
        <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm text-indigo-800 print:hidden">
          이미 설치된 앱에서 보고 있습니다. 아래는 다른 기기에 깔 때 쓰세요.
        </p>
      )}

      <section className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-5">
        {/* next/image 를 안 쓴다. QR 은 다시 샘플링되면 안 되는 그림이고,
            크기가 고정이라 최적화가 보탤 것이 없다. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={`${APP_URL} QR 코드`} className="h-48 w-48" />
        {/* 주소를 글자로도 둔다. QR 이 안 찍히는 폰이 있고, 인쇄물이
            흐리게 나올 수도 있다. */}
        <p className="text-sm font-medium tracking-tight text-slate-900">{APP_URL}</p>
        <p className="text-xs text-slate-500">폰 카메라로 찍거나 주소를 직접 입력하세요.</p>
      </section>

      <Steps
        title="아이폰 · 아이패드"
        steps={[
          '사파리로 엽니다. 크롬으로는 홈 화면에 추가할 수 없습니다.',
          '아래 공유 단추(□↑)를 누릅니다.',
          '「홈 화면에 추가」를 고릅니다.',
          '깐 앱을 열면 로그인 화면이 나옵니다. 한 번 더 로그인하세요 — 고장이 아니라, 홈 화면 앱은 사파리와 저장 공간이 따로입니다.',
        ]}
      />

      <Steps
        title="안드로이드"
        steps={[
          '크롬으로 엽니다.',
          '주소창에 뜨는 「앱 설치」를 누릅니다. 안 보이면 오른쪽 위 ⋮ → 「앱 설치」입니다.',
          '홈 화면에 아이콘이 생깁니다.',
        ]}
      />

      <div className="print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          인쇄 · PDF로 저장
        </button>
        <p className="mt-1.5 text-xs text-slate-400">
          인쇄 창에서 「PDF로 저장」을 고르면 파일로 남길 수 있습니다.
        </p>
      </div>
    </div>
  );
}
