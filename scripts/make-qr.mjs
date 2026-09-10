// 설치 주소 QR 을 굽는다.
//
// 주소가 안 바뀐다(https://moa.noavibe.app 하나뿐). 그러면 런타임에 만들 것이
// 아니라 한 번 구워 커밋할 것이다 — 화면은 <img> 하나면 되고 의존성이 안 는다.
//
// 이름에 내용 해시를 넣는다. 아이콘에서 겪은 일이다: 주소가 그대로면 그림을
// 바꿔도 브라우저가 옛것을 계속 쓴다. 배포는 정상인데 화면만 안 바뀐다.
//
// qrcode 는 devDependency 다. 결과물이 커밋되므로 빌드도 런타임도 안 다친다.
//
// 돌리는 법: node scripts/make-qr.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import QRCode from 'qrcode';

const OUT = join(process.cwd(), 'public', 'icons');
const URL = 'https://moa.noavibe.app';

// 512px. 화면에는 200px 안팎으로 그리지만, 인쇄했을 때 카메라가 잡으려면
// 원본이 커야 한다.
//
// 여백(margin)을 2 로 둔다. QR 은 사방에 흰 여백이 있어야 인식된다 — 0 으로
// 두면 종이나 어두운 배경에 붙었을 때 못 읽는다.
const png = await QRCode.toBuffer(URL, {
  type: 'png',
  width: 512,
  margin: 2,
  errorCorrectionLevel: 'M',
  color: { dark: '#0f172a', light: '#ffffff' },
});

const hash = createHash('sha256').update(png).digest('hex').slice(0, 8);
const file = `install-qr.${hash}.png`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, file), png);

// 지난 판을 치운다. 우리가 만든 이름만 건드린다.
for (const name of readdirSync(OUT)) {
  if (/^install-qr(\.[0-9a-f]{8})?\.png$/.test(name) && name !== file) {
    rmSync(join(OUT, name));
    console.log(`  (지움) ${name}`);
  }
}

console.log(`  ${file}`);
console.log('');
console.log('lib/newsItems.js 의 image 에 이 주소를 적으세요:');
console.log(`  /icons/${file}`);
