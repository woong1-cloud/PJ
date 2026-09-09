// 아이콘을 SVG 하나에서 뽑는다.
//
// 손으로 그린 PNG 를 저장소에 넣지 않는 이유는 하나다 — 로고가 생겼을 때
// 이 파일만 고치면 전부 함께 바뀐다.
//
// **파일 이름에 내용 해시를 넣는다.** 안 넣으면 그림을 바꿔도 주소가 그대로라
// 브라우저와 안드로이드가 옛 아이콘을 계속 쓴다. 실제로 겪었다 — 배포는
// 정상이었고(운영 서버의 바이트가 로컬과 같았다) 지웠다 다시 깔아도 옛
// 아이콘이 나왔다. 안드로이드는 설치할 때 아이콘을 구운 꾸러미를 만들고,
// 주소가 같으면 그것을 다시 만들 이유를 못 찾는다.
//
// 그래서 이 스크립트가 manifest.json 의 icons 까지 고쳐 쓴다. 사람이 두 곳을
// 맞추게 하면 언젠가 한쪽만 고치고, 그 실패는 조용하다.
//
// apple-touch-icon 은 여기서 안 만든다. app/apple-icon.png 로 두면 Next 가
// 해시 붙은 주소로 내주고 <link rel="apple-touch-icon"> 도 알아서 넣는다 —
// app/favicon.ico 가 이미 그렇게 돌고 있다.
//
// sharp 는 우리 package.json 에 없다. next 가 끌고 오는 전이 의존성이다
// (next 16.2.12 → sharp 0.34.5). 지금은 그냥 돌지만 next 가 그걸 떼면
// 이 스크립트만 조용히 깨진다 — 결과물이 커밋돼 있으므로 빌드도 런타임도
// 안 다친다. 그때는 `npm i -D sharp` 로 명시하고 돌리면 된다.
//
// 돌리는 법: node scripts/make-icons.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ICON_DIR = join(process.cwd(), 'public', 'icons');
const APP_DIR = join(process.cwd(), 'app');
const MANIFEST = join(process.cwd(), 'public', 'manifest.json');

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

// 매니페스트에 실리는 것들. 이름에 해시가 붙는다.
const MANIFEST_ICONS = [
  { base: 'icon-192', size: 192, radius: 42, scale: 1, sizes: '192x192' },
  { base: 'icon-512', size: 512, radius: 112, scale: 1, sizes: '512x512' },
  // maskable 은 시스템이 모양을 씌운다. 사각으로 꽉 채우고, 그림은 가운데
  // 80% 안(안드로이드 세이프존)에 들어가도록 줄인다.
  { base: 'icon-512-maskable', size: 512, radius: 0, scale: 0.78, sizes: '512x512', purpose: 'maskable' },
];

function hash8(buffer) {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 8);
}

mkdirSync(ICON_DIR, { recursive: true });

const icons = [];
const keep = new Set();
for (const spec of MANIFEST_ICONS) {
  const png = await sharp(svg(spec)).png().toBuffer();
  const file = `${spec.base}.${hash8(png)}.png`;
  writeFileSync(join(ICON_DIR, file), png);
  keep.add(file);
  icons.push({
    src: `/icons/${file}`,
    sizes: spec.sizes,
    type: 'image/png',
    ...(spec.purpose ? { purpose: spec.purpose } : {}),
  });
  console.log(`  ${file}`);
}

// 지난 판을 치운다. 이름이 바뀌므로 안 지우면 폴더에 계속 쌓이고, 어느 것이
// 지금 쓰이는지 알 수 없게 된다. 우리가 만든 이름만 건드린다.
const MINE = new RegExp(`^(${MANIFEST_ICONS.map((s) => s.base).join('|')})(\.[0-9a-f]{8})?\.png$`);
for (const name of readdirSync(ICON_DIR)) {
  if (MINE.test(name) && !keep.has(name)) {
    rmSync(join(ICON_DIR, name));
    console.log(`  (지움) ${name}`);
  }
}

// iOS 것. Next 의 파일 관례라 해시는 Next 가 붙인다.
const apple = await sharp(svg({ size: 180, radius: 0, scale: 1 })).png().toBuffer();
writeFileSync(join(APP_DIR, 'apple-icon.png'), apple);
console.log('  app/apple-icon.png');

// 매니페스트를 고쳐 쓴다. icons 만 바꾸고 나머지는 그대로 둔다.
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
manifest.icons = icons;
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log('  public/manifest.json 의 icons 를 새 이름으로 바꿨습니다');
