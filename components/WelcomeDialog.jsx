'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useIdentity } from '@/components/IdentityProvider';
import { onboardingSlides, shouldShowOnboarding } from '@/lib/onboarding';

// 첫 로그인에 한 번 뜨는 안내.
//
// 투어(화면 위에 말풍선을 띄우며 요소를 가리키는 방식)를 쓰지 않았다. 이 앱은
// 지금도 매주 화면이 바뀌고 있어서, 특정 요소를 가리키는 안내는 다음 배포에
// 깨진다. 깨진 투어는 없는 것보다 나쁘다 — 엉뚱한 곳을 가리킨다.
//
// 대신 세 장짜리 다이얼로그다. 화면 구조와 무관하므로 깨질 일이 없고,
// "지금 뭘 해야 하는지" 는 빈 화면 안내가 따로 맡는다.
export function WelcomeDialog() {
  const { identity } = useIdentity();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => {
        if (cancelled || !me) return;
        if (shouldShowOnboarding(me)) setOpen(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const slides = onboardingSlides(identity);
  const last = step === slides.length - 1;

  function finish() {
    // 닫기가 먼저다. 기록에 실패해도 창은 닫힌다 — 안내를 한 번 더 보는 것보다
    // "닫기를 눌렀는데 안 닫힌다" 가 훨씬 나쁘다.
    setOpen(false);
    fetch('/api/me/onboarded', { method: 'POST' }).catch(() => {});
  }

  if (!open) return null;
  const slide = slides[step];

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        // Esc 나 바깥 클릭으로 닫아도 본 것으로 친다. 끝까지 안 봤다고 다음에
        // 또 띄우면, 닫고 싶은 사람은 매번 같은 창을 다시 만난다.
        if (!next) finish();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{slide.title}</DialogTitle>
        </DialogHeader>

        <p className="text-sm leading-relaxed break-keep text-slate-600">{slide.body}</p>

        <div className="flex items-center gap-1.5" aria-hidden="true">
          {slides.map((s, i) => (
            <span
              key={s.key}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-5 bg-indigo-500' : 'w-1.5 bg-slate-200'
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex-row items-center gap-2 border-t border-slate-100 pt-3">
          {/* 도움말은 늘 열어 둔다. 지금 자세히 읽고 싶은 사람을 세 장짜리
              요약에 가두지 않는다. */}
          <Link
            href="/help"
            onClick={finish}
            className="mr-auto text-xs text-slate-500 underline hover:text-slate-700"
          >
            도움말 전체 보기
          </Link>
          {last ? (
            <Button
              type="button"
              onClick={finish}
              className="h-11 bg-indigo-600 hover:bg-indigo-700 md:h-9"
            >
              시작하기
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={finish} className="h-11 md:h-9">
                건너뛰기
              </Button>
              <Button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="h-11 bg-indigo-600 hover:bg-indigo-700 md:h-9"
              >
                다음
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
