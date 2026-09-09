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
const BRAND = '#4f46e5'; // indigo-600. 로그인 화면과 주요 단추가 쓰는 색

// ratio 는 글자가 차지하는 몫이다. maskable 은 안드로이드가 원·사각·물방울로
// 깎으므로 가장자리 20%가 잘려도 되게 그림을 가운데로 몬다.
function svg({ size, radius, ratio }) {
  const font = Math.round(size * ratio);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BRAND}"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle"
        font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif"
        font-size="${font}" font-weight="700" fill="#ffffff">모아</text>
</svg>`,
  );
}

const JOBS = [
  // 일반 아이콘. 모서리를 둥글게 깎아 둔다.
  { file: 'icon-192.png', size: 192, radius: 42, ratio: 0.38 },
  { file: 'icon-512.png', size: 512, radius: 112, ratio: 0.38 },
  // maskable 은 시스템이 모양을 씌운다. 사각으로 꽉 채우고 글자를 작게.
  { file: 'icon-512-maskable.png', size: 512, radius: 0, ratio: 0.26 },
  // iOS 는 자기가 모서리를 깎고, **알파를 검게 칠한다** — 배경을 꽉 채운다.
  { file: 'apple-touch-icon.png', size: 180, radius: 0, ratio: 0.38 },
];

mkdirSync(OUT, { recursive: true });
for (const job of JOBS) {
  await sharp(svg(job)).png().toFile(join(OUT, job.file));
  console.log(`  ${job.file}  ${job.size}x${job.size}`);
}
console.log(`\n${JOBS.length}개 만들었습니다 — public/icons/`);
