// 사내 시스템에 올릴 ZIP 을 만든다.  실행: npm run package
//
// next build 가 만드는 .next/standalone 을 그대로 압축하면 안 된다. Next 는
// standalone 에 server.js 와 최소 node_modules 만 넣고, 다음 두 개는 넣지
// 않는다 — 이건 Next 의 버그가 아니라 문서에 적힌 동작이다.
//   .next/static  : JS/CSS 번들. 없으면 화면이 스타일 없는 HTML 로 뜬다.
//   public        : 아이콘 등. 없으면 404 만 난다.
// 둘 다 "서버는 뜨는데 화면이 깨진다"로 나타나서, 받은 쪽에서는 앱이 고장난
// 것처럼 보인다. 그래서 이 스크립트가 반드시 필요하다.
import { createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// archiver 8 은 default export 가 없다. 클래스를 이름으로 가져온다.
import { ZipArchive } from 'archiver';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const standalone = path.join(root, '.next', 'standalone');
const distRoot = path.join(root, 'dist');

function fail(message) {
  console.error(`\n[실패] ${message}\n`);
  process.exit(1);
}

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

// 시각은 파일 이름에만 쓴다. 같은 날 두 번 만들면 앞의 것을 덮어써서
// "어제 준 ZIP" 을 다시 꺼낼 수 없게 되는 걸 막는다.
function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

async function main() {
  if (!(await exists(path.join(standalone, 'server.js')))) {
    fail('.next/standalone/server.js 가 없습니다. 먼저 `npm run build` 를 실행하세요.\n' +
      '       (next.config.mjs 의 output:"standalone" 이 지워졌는지도 확인하세요.)');
  }

  const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const name = `moa-${version}-${stamp()}`;
  const stage = path.join(distRoot, name);

  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { recursive: true });

  console.log('1/5 standalone 복사');
  await cp(standalone, stage, { recursive: true });

  console.log('2/5 .next/static, public 채우기 (Next 가 빼먹는 부분)');
  await cp(path.join(root, '.next', 'static'), path.join(stage, '.next', 'static'), {
    recursive: true,
  });
  if (await exists(path.join(root, 'public'))) {
    await cp(path.join(root, 'public'), path.join(stage, 'public'), { recursive: true });
  }

  // 여기서 지우지 않으면 service_role 키가 ZIP 에 담겨 사내 파일 서버를 돌아다닌다.
  // 그 키는 RLS 를 우회하므로 유출되면 DB 전체가 열린다. 지운 사실을 반드시
  // 화면에 찍어서, 조용히 통과했는지 아닌지 눈으로 확인할 수 있게 한다.
  console.log('3/5 비밀값 제거');
  const stray = (await readdir(stage)).filter((f) => f.startsWith('.env'));
  for (const f of stray) {
    await rm(path.join(stage, f), { force: true });
    console.log(`    - 제거: ${f}`);
  }
  if (stray.length === 0) console.log('    - .env 파일 없음 (정상)');

  console.log('4/5 배포 안내 작성');
  await writeFile(path.join(stage, '.env.local.example'), ENV_EXAMPLE, 'utf8');
  await writeFile(path.join(stage, '배포안내.md'), guide(name), 'utf8');

  console.log('5/5 압축');
  const zip = path.join(distRoot, `${name}.zip`);
  await rm(zip, { force: true });
  await compress(stage, zip);

  const { size } = await stat(zip);
  console.log(`\n완료: dist/${path.basename(zip)} (${(size / 1024 / 1024).toFixed(1)} MB)`);
  console.log('풀어서 `node server.js` 로 실행합니다. 자세한 건 ZIP 안의 배포안내.md.\n');
}

// archiver 를 쓰는 이유: 처음에는 윈도우 기본 명령인 Compress-Archive 로
// 만들었는데, 방금 복사한 파일을 다른 프로세스가 잡고 있다며 실패했다.
// 그런데 PowerShell 은 종료 코드를 0 으로 돌려주기 때문에 스크립트는
// "성공"으로 넘어가고 ZIP 만 없었다. 배포 스크립트가 조용히 실패하는 것이
// 가장 나쁘므로, 실패가 예외로 올라오는 라이브러리로 바꿨다.
function compress(dir, zipPath) {
  return new Promise((resolve, reject) => {
    const out = createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    out.on('close', resolve);
    archive.on('warning', reject);
    archive.on('error', reject);
    archive.pipe(out);
    // 두 번째 인자로 폴더 이름을 주면 ZIP 안에 그 폴더가 한 겹 생긴다.
    // 없으면 압축을 푼 자리에 파일 수천 개가 쏟아진다.
    archive.directory(dir, path.basename(dir));
    archive.finalize();
  });
}

// 이 두 줄이 정확해야 한다. 실제로 SUPABASE_URL 을 빼먹은 채 ZIP 을 만들어
// 실행해 봤더니, 화면은 정상으로 열리고 로그인 화면까지 뜨는데 데이터를 쓰는
// 순간 500 이 났다. 받는 쪽에서는 앱이 고장난 것으로 보인다.
const ENV_EXAMPLE = `# 서버가 실행할 때 읽는 값. 이 파일 이름을 .env.local 로 바꾸고 채웁니다.
# 둘 다 필수입니다. 하나만 채우면 화면은 열리지만 데이터 조회에서 500 이 납니다.

# Supabase 프로젝트 URL (예: https://xxxx.supabase.co)
SUPABASE_URL=

# service_role 키. RLS 를 우회하는 키입니다. 이 앱은 권한 판정을 전부 서버
# 라우트에서 하기 때문에 반드시 필요하지만, 브라우저로는 절대 나가지 않습니다.
# 사내 위키나 메신저에 붙이지 마세요.
SUPABASE_SERVICE_ROLE_KEY=
`;

function guide(name) {
  return `# 모아 MOA 배포 안내 (${name})

## 필요한 것
- Node.js 20 이상
- Supabase 프로젝트 (마이그레이션 0001~0011 적용 완료)

## 실행
1. 이 폴더의 \`.env.local.example\` 을 \`.env.local\` 로 복사하고 두 값을 채웁니다.
2. 실행:

\`\`\`
HOSTNAME=0.0.0.0 PORT=3000 node server.js
\`\`\`

\`HOSTNAME\` 을 반드시 주세요. 안 주면 Next 가 서버의 컴퓨터 이름으로 바인딩해서
\`http://localhost:3000\` 으로도 접속이 안 됩니다("연결 거부"만 보입니다).
실제로 그렇게 동작하는 것을 확인했습니다.

윈도우 서버라면:

\`\`\`
set HOSTNAME=0.0.0.0
set PORT=3000
node server.js
\`\`\`

## 환경변수가 두 종류인 이유 (중요)

\`NEXT_PUBLIC_\` 으로 시작하는 값(Supabase URL, anon key)은 **빌드할 때
브라우저 코드에 박혀 들어갑니다.** 이 ZIP 을 만든 시점의 값이 이미 들어가
있어서, 여기서 \`.env.local\` 에 다시 적어도 바뀌지 않습니다.
→ **Supabase 프로젝트를 옮기려면 ZIP 을 다시 만들어야 합니다.**

반대로 \`SUPABASE_URL\` 과 \`SUPABASE_SERVICE_ROLE_KEY\` 는 서버가 실행할 때
읽으므로 \`.env.local\` 에 넣으면 됩니다. 그래서 이 ZIP 에는 키가 없습니다.

## 확인 (순서대로)
1. \`/login\` 이 열리고 이메일/비밀번호 칸이 **모양을 갖춰서** 보인다
   → 정적 파일 정상. 글자만 나오고 모양이 없으면 \`.next/static\` 이 빠진 것.
2. \`/api/signup/brands\` 가 브랜드 목록 JSON 을 돌려준다
   → \`.env.local\` 과 DB 연결 정상. 500 이면 \`SUPABASE_URL\` 을 확인하세요.
3. 로그인하면 요구사항 목록이 뜬다 → 끝.

## 되돌리기
이전 ZIP 을 풀어 \`node server.js\` 를 다시 실행하면 됩니다. DB 는 건드리지
않으므로 앱만 되돌아갑니다. 다만 마이그레이션을 새로 적용한 뒤라면 DB 는
새 구조 그대로이니, 스키마를 바꾸는 배포는 되돌리기 전에 확인이 필요합니다.
`;
}

await main();
