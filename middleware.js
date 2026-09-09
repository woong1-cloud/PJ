import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// 비로그인 상태로 열 수 있는 화면. /signup 이 여기 없으면 가입하러 온 사람이
// 곧장 /login 으로 튕겨 나가 가입 자체가 불가능해진다.
// (/api/* 는 아래 matcher에서 이미 제외되므로 여기 적지 않는다.)
const PUBLIC_PATHS = ['/login', '/signup', '/change-password'];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !PUBLIC_PATHS.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // manifest.json · sw.js · icons/ 를 뺀다.
  //
  // 안 빼면 비로그인 상태에서 셋이 /login 으로 307 된다. 매니페스트는
  // HTML 이 되어 무효가 되고, sw.js 는 콘텐츠 타입이 안 맞아 등록 자체가
  // 실패한다. 로그인한 뒤에는 쿠키가 붙어 통과하므로 **본인 화면에서는
  // 멀쩡해 보인다** — 설치를 권하고 싶은 로그인 화면에서만 안 된다.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|manifest\.json|sw\.js|icons/).*)'],
};
