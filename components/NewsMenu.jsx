'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SparklesIcon } from 'lucide-react';
import { NEWS, POPOVER_LIMIT, unseenNews } from '@/lib/newsItems';
import { readDismissed, shouldOpenDialog, writeDismissed } from '@/lib/newsDismiss';
import { NewsDialog } from '@/components/NewsDialog';
import { NewsItem } from '@/components/news/NewsItem';

// 업데이트 소식 입구.
//
// 왜 헤더로 꺼냈나: 소식이 계정 메뉴 → 도움말 → 스크롤 안에 있었다. 팝업이
// 한 번 뜨고 그것을 닫으면 그 뒤로 아무도 그 네 뎁스를 지나가지 않는다.
// 배포는 3주에 다섯 번 나갔는데 전달 경로가 한 번뿐이면, 그 한 번을 놓친
// 사람에게는 없는 기능과 같다.
//
// 벨에 합치지 않는다. 인앱 알림은 110건 중 105건이 안 읽혔다 — 이미 아무도
// 안 여는 통에 넣으면 소식도 같이 묻히고, 벨의 숫자는 "읽어야 할 것"과
// "한 번 보면 되는 것"이 섞여 더 무의미해진다.
// 벨은 나에게 온 것, 이 아이콘은 모아에 생긴 것이다.
//
// 이 컴포넌트가 아이콘·점·팝오버·팝업을 다 소유한다. 나누면 /api/me 를 두 번
// 부르게 되고, 팝업에서 확인을 눌러도 아이콘의 점이 안 사라진다 — 각자 자기
// 상태를 들고 있기 때문이다.
//
// 의견 보내기는 여기 없다. 처음엔 팝오버 하단에 뒀는데, 이 팝오버는 점이
// 떠 있을 때만 열리는 자리라 배포 직후 며칠만 존재하는 입구가 됐다. 헤더에
// 아이콘을 따로 뒀고, 그것이 바로 옆(28px)에 있으므로 여기 한 번 더 두면
// 같은 것이 두 번 보이는 소음이다.
export function NewsMenu() {
  const [seenAt, setSeenAt] = useState(undefined); // undefined = 아직 모름
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [dialogItems, setDialogItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => {
        if (cancelled || !me) return;
        setSeenAt(me.newsSeenAt ?? null);
        setReady(true);

        // 팝업은 몇 가지가 겹칠 때만 안 띄운다.
        //
        // 비밀번호를 바꿔야 하는 사람은 지금 로그인 절차 한가운데에 있다.
        // 첫 로그인 안내를 아직 안 본 사람에게 "무엇이 바뀌었습니다"는 아무
        // 뜻이 없다 — 바뀌기 전을 본 적이 없으니까(안내를 닫는 쪽이
        // news_seen_at 까지 함께 찍는다).
        if (me.mustChangePassword || !me.onboardedAt) return;

        const unseen = unseenNews(NEWS, me.newsSeenAt);
        if (shouldOpenDialog(unseen, readDismissed())) setDialogItems(unseen);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const unseen = ready ? unseenNews(NEWS, seenAt) : [];
  const hasUnseen = unseen.length > 0;
  // 최근 것만. 그 이상은 '전체 보기'다 — 세 건을 넘겨 받으면 팝오버가 화면
  // 절반을 먹고, 오래된 소식은 어차피 안 읽는다.
  const visible = NEWS.slice(0, POPOVER_LIMIT);

  // 서버에 "여기까지 봤다"를 찍는다. 실패해도 화면은 그대로 진행한다 —
  // 소식을 한 번 더 보는 것보다 "눌렀는데 아무 일도 안 난다"가 훨씬 나쁘다.
  function markSeen() {
    setSeenAt(new Date().toISOString());
    setDialogItems([]);
    fetch('/api/me/news-seen', { method: 'POST' }).catch(() => {});
  }

  function togglePopover() {
    const next = !open;
    setOpen(next);
    // 여는 행동 자체가 읽는 것이다. 따로 '확인'을 받지 않는다.
    if (next && hasUnseen) markSeen();
  }

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={togglePopover}
        aria-label={hasUnseen ? '업데이트 소식 (새 소식 있음)' : '업데이트 소식'}
        aria-expanded={open}
        className="relative flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        <SparklesIcon className="h-4 w-4" />
        {/* 숫자가 아니라 점이다. 소식은 "몇 건"이 아니라 "있다/없다"만
            중요하고, 숫자를 붙이면 옆의 벨과 같은 것으로 읽힌다. */}
        {hasUnseen && (
          <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-indigo-600" />
        )}
      </button>

      {open && (
        <>
          {/* 바깥을 누르면 닫는다 */}
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 top-9 z-20 flex max-h-[70vh] w-80 flex-col rounded-lg border border-slate-200 bg-white shadow-lg">
            <p className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
              새로 바뀐 것
            </p>

            {/* 제목만 늘어놓지 않고 본문까지 담는다. 제목만 보여주면 무엇이
                바뀌었는지 알려고 한 번 더 눌러야 하는데, 그러면 뎁스를 줄이려고
                만든 것이 다시 뎁스를 만든다. */}
            <ul className="flex flex-col gap-3 overflow-y-auto px-3 py-3">
              {visible.map((item) => (
                <NewsItem key={item.date} item={item} compact />
              ))}
            </ul>

            <div className="border-t border-slate-100 px-3 py-2">
              <Link
                href="/help#news"
                onClick={() => setOpen(false)}
                className="text-xs text-slate-500 hover:text-indigo-600"
              >
                전체 보기
              </Link>
            </div>
          </div>
        </>
      )}

      <NewsDialog
        items={dialogItems}
        onConfirm={markSeen}
        onDismiss={() => {
          // 팝업만 멈춘다. 점은 남겨 둔다 — 반사적으로 닫은 사람을 아이콘이
          // 계속 부른다.
          writeDismissed(dialogItems[0]?.date);
          setDialogItems([]);
        }}
      />
    </div>
  );
}
