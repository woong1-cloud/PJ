'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NEWS, unseenNews } from '@/lib/newsItems';

// 안 본 업데이트 소식이 있으면 로그인 후 한 번 뜬다.
//
// 이 기능이 있는 이유: 3주 동안 큰 변화가 네 번 나갔는데 안내가 한 번도 없었다.
// 그중 하나는 목록의 기본 화면이 표에서 행으로 바뀌는 것이라, 쓰던 사람은
// 로그인했다가 고장인지 바뀐 것인지 알 수 없었다.
//
// 첫 로그인 안내(WelcomeDialog)와 겹치면 안내가 먼저다 — 처음 온 사람에게
// "뭐가 바뀌었습니다"는 아무 뜻이 없다. 그래서 onboardedAt 이 없으면 여기서
// 아무것도 안 띄우고, 안내를 닫는 쪽이 news_seen_at 까지 함께 찍는다.
export function NewsDialog() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => {
        if (cancelled || !me) return;
        // 비밀번호를 바꿔야 하는 사람에게는 아무것도 안 띄운다. 그 사람은
        // 지금 로그인 절차 한가운데에 있다.
        if (me.mustChangePassword) return;
        // 첫 로그인 안내가 먼저다.
        if (!me.onboardedAt) return;
        const unseen = unseenNews(NEWS, me.newsSeenAt);
        if (unseen.length > 0) {
          setItems(unseen);
          setOpen(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function finish() {
    // 닫기가 먼저다. 기록에 실패해도 창은 닫힌다 — 소식을 한 번 더 보는 것보다
    // "닫기를 눌렀는데 안 닫힌다" 가 훨씬 나쁘다.
    setOpen(false);
    fetch('/api/me/news-seen', { method: 'POST' }).catch(() => {});
  }

  if (!open || items.length === 0) return null;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        // Esc 나 바깥 클릭으로 닫아도 본 것으로 친다. 다 안 읽었다고 다음에 또
        // 띄우면, 닫고 싶은 사람은 매번 같은 창을 다시 만난다.
        if (!next) finish();
      }}
    >
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {items.length === 1 ? '새로 바뀐 것' : `새로 바뀐 것 ${items.length}가지`}
          </DialogTitle>
        </DialogHeader>

        {/* 한 창에 전부 담는다. 온보딩처럼 넘기게 만들면 마지막 장은 아무도
            안 읽는데, 소식은 앞의 것이 더 중요하지도 않다. */}
        <ul className="flex flex-col gap-4">
          {items.map((item) => (
            <li key={item.date} className="border-l-2 border-indigo-500 pl-3">
              <p className="text-[11px] text-slate-400">{item.date}</p>
              <p className="mt-0.5 text-sm font-medium text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm leading-relaxed break-keep text-slate-600">{item.body}</p>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button type="button" onClick={finish} className="bg-indigo-600 hover:bg-indigo-700">
            확인했습니다
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
