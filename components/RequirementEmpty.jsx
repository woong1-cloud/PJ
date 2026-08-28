'use client';

// 목록이 비었을 때 보여줄 것.
//
// 표와 목록(행)이 함께 쓴다. 뷰마다 다른 빈 화면을 보여주면, 뷰를 바꿨을 때
// 데이터가 달라진 것처럼 읽힌다.
//
// 빈 화면은 안내를 둘 자리다. 환영 창은 한 번 보고 잊지만 이 화면은 아무것도
// 없을 때마다 나오고, 마침 사용자가 "그래서 뭘 하지" 하는 순간이다.
//
// filtered: 필터 때문에 비었는지 정말로 없는지. 같은 문구를 두면 필터를 걸어
// 둔 사람에게 "첫 요구사항을 올려 보세요" 라고 하게 되는데, 그 사람은 자기가
// 올린 것을 찾고 있던 중이다.
export function RequirementEmpty({ filtered = false, onCreate }) {
  if (filtered) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        조건에 맞는 요구사항이 없습니다. 위의 필터를 지우면 전체가 보입니다.
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
      <p className="font-medium text-slate-900">아직 등록된 요구사항이 없습니다</p>
      <p className="mx-auto mt-2 max-w-md text-sm break-keep text-slate-500">
        불편한 점이나 바라는 것을 올리면 IT 담당자에게 전달되고, 어디까지 진행됐는지 이
        목록에서 계속 볼 수 있습니다.
      </p>
      {onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
        >
          첫 요구사항 등록하기
        </button>
      )}
    </div>
  );
}
