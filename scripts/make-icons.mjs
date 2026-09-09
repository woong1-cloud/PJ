// 아이콘 넷을 SVG 하나에서 뽑는다.
//
// 손으로 그린 PNG 를 저장소에 넣지 않는 이유는 하나다 — 로고가 생겼을 때
// 이 파일만 고치면 넷이 함께 바뀐다.
//
// sharp 는 우리 package.json 에 없다. next 가 끌고 오는 전이 의존성이다
// (next 16.2.12 → sharp 0.34.5). 지금은 그냥 돌지만 next 가 그걸 떼면
// 이 스크립트만 조용히 깨진다 — 결과물 PNG 는 커밋돼 있으므로 빌드도
// 런타임도 안 다친다. 그때는 `npm i -D sharp` 로 명시하고 돌리면 된다.
//
// 돌리는 법: node scripts/make-icons.mjs
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const OUT = join(process.cwd(), 'public', 'icons');

const INK = '#000000'; // 바탕
const PAPER = '#ffffff'; // 글자
const ACCENT = '#6366f1'; // indigo-500. 앱이 쓰는 인디고와 이어 둔다

// 검정 바탕에 흰 MOA, 그 아래 인디고 밑줄.
//
// 밑줄이 장식이 아니다. 순검정 아이콘은 **어두운 배경화면 위에서 경계가
// 사라져** 글자만 떠 있는 것처럼 보인다. 검정이 아닌 요소가 하나 있어야
// 아이콘이 물건으로 읽힌다.
//
// 테두리로 같은 일을 할 수도 있지만 그건 가장자리에 있어서 안드로이드가
// 모양대로 깎을 때 통째로 날아가고, 아이폰의 부푼 모서리와도 어긋난다.
// 밑줄은 가운데 쪽이라 어떻게 깎여도 남는다.
function svg({ size, radius, scale }) {
  const mid = size / 2;
  const barWidth = size * 0.32;
  const barHeight = size * 0.035;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${INK}"/>
  <g transform="translate(${mid},${mid}) scale(${scale}) translate(${-mid},${-mid})">
    <text x="50%" y="45%" dy="0.35em" text-anchor="middle"
          font-family="Arial Black, Arial, sans-serif"
          font-size="${size * 0.3}" font-weight="900" fill="${PAPER}">MOA</text>
    <rect x="${(size - barWidth) / 2}" y="${size * 0.63}"
          width="${barWidth}" height="${barHeight}" rx="${barHeight / 2}" fill="${ACCENT}"/>
  </g>
</svg>`,
  );
}

const JOBS = [
  // 일반 아이콘. 모서리를 둥글게 깎아 둔다.
  { file: 'icon-192.png', size: 192, radius: 42, scale: 1 },
  { file: 'icon-512.png', size: 512, radius: 112, scale: 1 },
  // maskable 은 시스템이 모양을 씌운다. 사각으로 꽉 채우고, 그림은 가운데
  // 80% 안(안드로이드 세이프존)에 들어가도록 줄인다.
  { file: 'icon-512-maskable.png', size: 512, radius: 0, scale: 0.78 },
  // iOS 는 자기가 모서리를 깎고, **알파를 검게 칠한다** — 배경을 꽉 채운다.
  { file: 'apple-touch-icon.png', size: 180, radius: 0, scale: 1 },
];

mkdirSync(OUT, { recursive: true });
for (const job of JOBS) {
  await sharp(svg(job)).png().toFile(join(OUT, job.file));
  console.log(`  ${job.file}  ${job.size}x${job.size}`);
}
console.log(`\n${JOBS.length}개 만들었습니다 — public/icons/`);
