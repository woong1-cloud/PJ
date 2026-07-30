// 사내 시스템에 올릴 ZIP 을 만든다.
//
//   npm run package        빌드 완료본 (직접 node server.js 로 띄우는 서버용)
//   npm run package:src    소스 (플랫폼이 install + build 를 대신 해 주는 경우)
//
// 왜 두 가지인가. 사내 배포 도구가 "ZIP 을 올리면 빌드까지 해 준다" 는 종류면
// 빌드 완료본을 주면 실패한다 — standalone 결과물에는 app/ 이나 components/ 가
// 없는데 package.json 의 "build": "next build" 는 그대로 남아 있어서, 도구가
// 빌드를 돌리다 소스를 못 찾는다. 실제로 그 실패를 겪고 이 모드를 만들었다.
//
// 반대로 그냥 Node 가 설치된 서버에 올려 직접 띄우는 경우라면 빌드 완료본이
// 맞다. install 도 build 도 필요 없다.
//
// --- 아래는 빌드 완료본 모드에 대한 설명 ---
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
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
// archiver 8 은 default export 가 없다. 클래스를 이름으로 가져온다.
import { ZipArchive } from 'archiver';

const run = promisify(execFile);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const standalone = path.join(root, '.next', 'standalone');
const distRoot = path.join(root, 'dist');

function fail(message) {
  console.error(`\n[실패] ${message}\n`);
  process.exit(1);
}

async function git(args) {
  const { stdout } = await run('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
  return stdout;
}

// 압축이 끝난 뒤 한 번 더 훑는다. 앞 단계에서 빠뜨렸는지 여기서 잡는다 —
// service_role 키가 사내 파일 서버를 돌아다니면 DB 전체가 열린다.
async function findEnvFiles(dir) {
  const found = [];
  async function walk(d, rel) {
    for (const entry of await readdir(d, { withFileTypes: true })) {
      const next = path.join(d, entry.name);
      const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(next, nextRel);
      else if (entry.name.startsWith('.env') && entry.name !== '.env.local.example') {
        found.push(nextRel);
      }
    }
  }
  await walk(dir, '');
  return found;
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
  if (process.argv.includes('--source')) return packSource();
  return packBuilt();
}

// 소스 ZIP. 플랫폼이 npm install 과 next build 를 대신 해 주는 경우용.
//
// 파일 목록을 손으로 고르지 않고 git 이 추적하는 것만 넣는다. .gitignore 가
// 이미 node_modules · .next · dist · .env* 를 걸러 주고 있어서, 목록을 두 곳에
// 관리하다 한쪽만 고쳐지는 사고를 피할 수 있다. 특히 .env.local 은 손으로
// 관리하는 목록에서 빠뜨리기 가장 쉬운 파일이다.
async function packSource() {
  const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const name = `moa-src-${version}-${stamp()}`;
  const zip = path.join(distRoot, `${name}.zip`);

  console.log('1/4 커밋 상태 확인');
  const dirty = (await git(['status', '--porcelain'])).trim();
  if (dirty) {
    // git archive 는 HEAD 를 압축하므로 커밋 안 된 변경은 ZIP 에 안 들어간다.
    // 그걸 모르고 올리면 "고쳤는데 배포에 반영이 안 됐다"가 된다.
    fail(
      '커밋되지 않은 변경이 있습니다. git archive 는 HEAD 만 담으므로\n' +
        '       이 변경은 ZIP 에 들어가지 않습니다. 먼저 커밋하세요:\n\n' +
        dirty
          .split('\n')
          .map((l) => `         ${l}`)
          .join('\n'),
    );
  }

  console.log('2/4 추적 파일 복사');
  const stage = path.join(distRoot, name);
  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { recursive: true });
  const files = (await git(['ls-files'])).split('\n').map((f) => f.trim()).filter(Boolean);
  for (const rel of files) {
    const to = path.join(stage, rel);
    await mkdir(path.dirname(to), { recursive: true });
    await cp(path.join(root, rel), to);
  }
  console.log(`    - ${files.length}개`);

  console.log('3/4 배포 안내 작성');
  await writeFile(path.join(stage, '.env.local.example'), SOURCE_ENV_EXAMPLE, 'utf8');
  await writeFile(path.join(stage, '배포안내.md'), sourceGuide(name), 'utf8');

  console.log('4/4 압축');
  await rm(zip, { force: true });
  await compress(stage, zip);

  const stray = await findEnvFiles(stage);
  if (stray.length > 0) fail(`ZIP 에 비밀 파일이 들어갔습니다: ${stray.join(', ')}`);
  console.log('    - .env.local 없음 확인 (정상)');

  const { size } = await stat(zip);
  console.log(`\n완료: dist/${path.basename(zip)} (${(size / 1024 / 1024).toFixed(1)} MB)`);
  console.log('플랫폼이 install + build 를 실행하는 배포용입니다.');
  console.log('환경변수 4개를 빌드 전에 넣어야 합니다 — ZIP 안의 배포안내.md 참고.\n');
}

async function packBuilt() {
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

// 소스 모드는 환경변수 네 개가 다 필요하다. 빌드 완료본과 갈리는 지점이라
// 따로 적는다 — 여기서 NEXT_PUBLIC_ 두 개를 빼먹으면 빌드는 성공하고 로그인만
// 안 된다(브라우저가 붙을 Supabase 주소를 모른다).
const SOURCE_ENV_EXAMPLE = `# 네 개 다 필요합니다.
#
# NEXT_PUBLIC_ 두 개는 "빌드할 때" 읽혀서 브라우저 코드에 박힙니다.
# 플랫폼의 환경변수 화면에 빌드 전에 넣어야 합니다. 빌드가 끝난 뒤 값을
# 바꾸면 반영되지 않습니다 — 다시 빌드해야 합니다.
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# 아래 두 개는 서버가 "실행할 때" 읽습니다.
# SUPABASE_URL 은 위 NEXT_PUBLIC_SUPABASE_URL 과 같은 값입니다.
SUPABASE_URL=https://xxxxx.supabase.co

# service_role 키. RLS 를 우회하는 키입니다. 이 앱은 권한 판정을 전부 서버
# 라우트에서 하기 때문에 반드시 필요하지만, 브라우저로는 절대 나가지 않습니다.
SUPABASE_SERVICE_ROLE_KEY=
`;

function sourceGuide(name) {
  return `# 모아 MOA 배포 안내 — 소스 ZIP (${name})

이 ZIP 은 **소스**입니다. 플랫폼이 의존성 설치와 빌드를 실행하는 배포용입니다.
서버에 직접 올려 바로 띄우려면 소스가 아닌 빌드 완료본 ZIP 을 쓰세요
(\`npm run package\`).

## 필요한 것
- Node.js 20 이상
- Supabase 프로젝트 (마이그레이션 0001~0011 적용 완료)

## 빌드/실행 명령

\`\`\`
npm ci
npm run build
npm start
\`\`\`

\`npm ci\` 에 \`--omit=dev\` 나 \`--production\` 을 **붙이지 마세요.**
Tailwind(\`tailwindcss\`, \`@tailwindcss/postcss\`)가 devDependencies 에 있고
빌드에 필요합니다. 빼면 빌드가 PostCSS 플러그인 오류로 실패합니다.

## 환경변수 (네 개, 빌드 전에 넣어야 함)

| 이름 | 언제 읽히는가 |
|---|---|
| \`NEXT_PUBLIC_SUPABASE_URL\` | **빌드 시점** — 브라우저 코드에 박힘 |
| \`NEXT_PUBLIC_SUPABASE_ANON_KEY\` | **빌드 시점** — 브라우저 코드에 박힘 |
| \`SUPABASE_URL\` | 실행 시점 (위 URL 과 같은 값) |
| \`SUPABASE_SERVICE_ROLE_KEY\` | 실행 시점 |

\`NEXT_PUBLIC_\` 두 개를 빌드 전에 넣지 않으면 **빌드는 성공하고 로그인만
안 됩니다** — 브라우저가 붙을 Supabase 주소를 모르는 상태로 빌드됩니다.
로그가 아니라 화면에서만 드러나는 실패라 찾기 어렵습니다.

플랫폼이 포트나 바인딩 주소를 지정하라고 하면 \`PORT\`, \`HOSTNAME=0.0.0.0\` 을
함께 주세요.

## 확인 (순서대로)
1. \`/login\` 이 **모양을 갖춘 채로** 열린다 → 빌드/정적파일 정상
2. \`/api/signup/brands\` 가 브랜드 목록 JSON 을 돌려준다 → DB 연결 정상
   (500 이면 \`SUPABASE_URL\` / \`SUPABASE_SERVICE_ROLE_KEY\` 확인)
3. 로그인하면 요구사항 목록이 뜬다 → 끝
   (여기서만 실패하면 \`NEXT_PUBLIC_\` 두 개를 빌드 전에 안 넣은 것입니다)
`;
}

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
