'use client';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NewsItem } from '@/components/news/NewsItem';

// 안 본 업데이트 소식을 로그인 후 한 번 보여준다.
//
// 이 기능이 있는 이유: 3주 동안 큰 변화가 다섯 번 나갔는데 안내가 한 번도
// 없었다. 그중 하나는 목록의 기본 화면이 표에서 행으로 바뀌는 것이라, 쓰던
// 사람은 로그인했다가 고장인지 바뀐 것인지 알 수 없었다.
//
// 열지 말지는 여기서 안 정한다. NewsMenu 가 정하고 이 컴포넌트는 받은 것을
// 그리기만 한다 — 아이콘의 점과 팝업이 같은 상태를 봐야 하기 때문이다.
//
// props:
//   items      — 보여줄 소식(날짜 내림차순)
//   onConfirm  — '확인했습니다'. 읽었다는 뜻이라 서버에 기록하고 점도 없앤다
//   onDismiss  — X · Esc · 바깥. 팝업만 멈추고 점은 남긴다
export function NewsDialog({ items = [], onConfirm, onDismiss }) {
  if (items.length === 0) return null;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        // 닫는 방법이 둘이고 뜻이 다르다.
        //
        // 예전에는 둘을 구분하지 않아서, 반사적으로 X 를 누른 사람이 안 읽음
        // 표시까지 함께 잃었다. 팝업은 멈추되 헤더의 점은 남겨 두면 그가
        // 궁금해지는 순간에 갈 곳이 한 번의 클릭 거리에 있다.
        if (!next) onDismiss();
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
            <NewsItem key={item.date} item={item} />
          ))}
        </ul>

        <DialogFooter>
          <Button type="button" onClick={onConfirm} className="bg-indigo-600 hover:bg-indigo-700">
            확인했습니다
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
