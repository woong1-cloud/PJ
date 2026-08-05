import Link from 'next/link';

// 라벨 옆에 붙는 작은 물음표. 누르면 도움말의 해당 섹션으로 간다.
//
// 배지 옆이 아니라 라벨 옆인 이유: 상태를 그리는 컨트롤이 경우마다 다르다.
// 3차 이상이면 가로를 꽉 채우는 셀렉트, 반려·취소면 배지, 4차면 배지다.
// 배지 옆에 붙이면 자리가 매번 달라지고 셀렉트일 때는 놓을 데가 없다.
// 라벨은 어느 경우에나 같은 자리에 있다.
//
// 라벨 자체를 링크로 만들지 않았다. 그러면 '상태'만 파랗게 뜨는데 바로 아래
// '담당자'·'예상일' 은 회색이라, 상태만 다른 종류의 것으로 읽힌다.
//
// -m-2.5 p-2.5 는 보이는 크기는 그대로 두고 누르는 범위만 넓힌다(36px).
// 16px 짜리 원을 그대로 두면 폰에서 두세 번 눌러야 들어간다.
export function HelpHint({ anchor, label }) {
  return (
    <Link
      href={`/help#${anchor}`}
      aria-label={`${label} 설명 보기`}
      title={`${label}이(가) 무슨 뜻인지 보기`}
      className="-m-2.5 inline-flex p-2.5 text-slate-400 transition-colors hover:text-slate-600"
    >
      <span
        aria-hidden="true"
        className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] leading-none"
      >
        ?
      </span>
    </Link>
  );
}
