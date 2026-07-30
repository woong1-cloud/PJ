'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BellIcon } from 'lucide-react';
import { notificationHref, relativeTime } from '@/lib/notifications';

// 60초. 웹소켓을 붙이지 않는다 — 알림은 "지금 당장"이 아니라 "놓치지 않는"
// 것이 목적이라 이 정도면 충분하고, 연결 하나 없는 쪽이 훨씬 덜 깨진다.
const POLL_MS = 60_000;

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(() => {
    fetch('/api/notifications')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      })
      // 알림 조회 실패로 상단바가 깨지면 안 된다. 다음 폴링에서 다시 시도한다.
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  function markRead(id) {
    return fetch(`/api/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {});
  }

  function handleClick(notification) {
    setOpen(false);
    // 화면을 먼저 고친다. 서버 응답을 기다렸다가 지우면 눌러도 잠깐 그대로라
    // 안 눌린 줄 알고 한 번 더 누르게 된다.
    if (!notification.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(c - 1, 0));
      markRead(notification.id);
    }
    // 갈 곳은 알림 자신이 안다(link → requirement_id 순). 배치 대기처럼
    // 요구사항이 없는 알림도 있고, 둘 다 없으면 읽음 처리만 한다.
    const href = notificationHref(notification);
    if (href) router.push(href);
  }

  function handleMarkAll() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    fetch('/api/notifications/read-all', { method: 'PATCH' })
      .then(load)
      .catch(() => {});
  }

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label={unreadCount > 0 ? `알림 ${unreadCount}건` : '알림'}
      >
        <BellIcon className="h-4 w-4" />
        {unreadCount > 0 && (
          // 세 자리가 되면 뱃지가 벨보다 커진다. 99를 넘으면 정확한 숫자가
          // 의미도 없다 — 어차피 "많다"는 뜻이다.
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-medium text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* 바깥을 누르면 닫힌다 — 계정 메뉴와 같은 방식이다. */}
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
            aria-label="알림 닫기"
          />
          <div className="absolute right-0 top-9 z-20 w-80 rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <span className="text-sm font-medium text-slate-900">알림</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  모두 읽음
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400">새 알림이 없습니다.</p>
            ) : (
              <ul className="max-h-96 overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(n)}
                      className={`flex w-full flex-col items-start gap-0.5 border-b border-slate-50 px-3 py-2 text-left hover:bg-slate-50 ${
                        n.is_read ? 'bg-white' : 'bg-indigo-50/40'
                      }`}
                    >
                      <span
                        className={`line-clamp-2 text-sm ${
                          n.is_read ? 'text-slate-500' : 'font-medium text-slate-900'
                        }`}
                      >
                        {n.message}
                      </span>
                      <span className="text-xs text-slate-400">{relativeTime(n.created_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
