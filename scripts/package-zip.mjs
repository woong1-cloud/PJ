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
// moa.noavibe.app 은 앞쪽이다 — 소스를 받아 @opennextjs/aws 로 다시 빌드한다.
// 즉 이 저장소의 실제 배포에는 package:src 만 쓴다.
//
// 그런데 이 주석을 여기 적어 둔 뒤에도 같은 실패를 다시 냈다. 주석은 스크립트를
// 실행하는 사람 눈앞에 없기 때문이다. 그래서 빌드 완료본 모드는 실행할 때마다
// 경고를 화면에 찍는다(BUILT_MODE_WARNING).
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
async function findEnvFiles(dir, allowed = ['.env.local.example']) {
  const found = [];
  async function walk(d, rel) {
    for (const entry of await readdir(d, { withFileTypes: true })) {
      const next = path.join(d, entry.name);
      const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(next, nextRel);
      else if (entry.name.startsWith('.env') && !allowed.includes(entry.name)) {
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

// --with-env 로 ZIP 안에 .env.local 을 넣는다.
//
// 넣는 값과 넣지 않는 값을 가른 기준은 "이미 공개되어 있는가" 다.
//
// NEXT_PUBLIC_SUPABASE_URL / ANON_KEY 는 빌드할 때 브라우저 코드에 박히므로
// 앱을 열어 본 사람은 누구나 이미 볼 수 있다. ZIP 에 넣어도 노출이 늘지 않는다.
// 게다가 이 둘은 빌드 시점에 필요해서, 플랫폼 환경변수 화면에 빠뜨리면
// "빌드는 성공하고 로그인만 안 되는" 가장 찾기 어려운 실패가 난다.
// 파일로 같이 보내면 그 실패 자체가 사라진다.
//
// SUPABASE_SERVICE_ROLE_KEY 는 다르다. RLS 를 우회하는 유일한 값이고,
// 나머지는 전부 RLS + 라우트 검사로 막혀 있다(anon 키로는 조회도 쓰기도 안 된다).
// ZIP 은 돌아다닌다 — 배포 도구 저장소에 남고, 다시 내려받고, 메신저로 전달되고,
// 다운로드 폴더에 남는다. 그 하나만 파일 밖에 두면 나머지 편의를 다 가져갈 수 있다.
function envFileBody(values) {
  return `# 이 파일은 npm run package:src -- --with-env 가 만들었습니다.
#
# 아래 세 값은 비밀이 아닙니다. NEXT_PUBLIC_ 두 개는 빌드할 때 브라우저
# 코드에 박히므로 앱을 열어 본 사람은 이미 볼 수 있습니다. 그래서 파일에
# 담아 보냅니다 — 빌드 전에 넣는 것을 잊어버리는 사고를 막는 쪽이 낫습니다.
NEXT_PUBLIC_SUPABASE_URL=${values.publicUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${values.anonKey}
SUPABASE_URL=${values.serverUrl}

# 가입 허용 이메일 도메인. 비밀이 아니라 정책값이라 파일에 담는다.
#
# 이 줄을 빈 값으로 두면 안 된다. 코드가 (process.env.X ?? '기본값') 형태라
# 값이 '없을 때'만 기본값으로 넘어가는데, 빈 문자열은 '없음'이 아니어서
# 허용 목록이 빈 배열이 된다. 그러면 아무도 가입할 수 없고, 가입 화면에는
# "사내 이메일(@undefined)로만 가입할 수 있습니다" 가 뜬다.
# 계열사가 늘면 쉼표로 이어 쓴다: eland.co.kr,elandmall.com
SIGNUP_ALLOWED_DOMAINS=${values.signupDomains}

# service_role 키는 일부러 비워 두었습니다.
#
# 이 키만 RLS 를 우회합니다. 나머지 값은 유출돼도 DB 가 열리지 않지만
# 이 키는 열립니다. ZIP 은 배포 도구 저장소에 남고 다시 내려받게 되므로,
# 이 한 줄만 파일 밖(플랫폼 환경변수 화면)에 두는 것을 권합니다.
#
# 그래도 여기에 직접 적으시려면 아래 = 뒤에 붙이면 동작합니다.
# 그 경우 배포가 끝난 뒤 Supabase 에서 키를 재발급하는 것을 권합니다.
SUPABASE_SERVICE_ROLE_KEY=

# ── 알림 메일(선택) ─────────────────────────────────────────────
# 비워 두면 메일 기능만 꺼지고 나머지는 전부 그대로 동작합니다.
# 인앱 알림(벨)은 이 설정과 무관합니다.
#
# 메일이 나가는 경우는 셋뿐입니다: 배치 대기(가입), 담당자 지정, @멘션.
#
# Gmail / Google Workspace 를 쓰신다면
#   SMTP_HOST=smtp.gmail.com  SMTP_PORT=587
#   SMTP_PASS 는 계정 비밀번호가 아니라 '앱 비밀번호'입니다(2단계 인증 필수).
#   Google 계정 > 보안 > 2단계 인증 > 앱 비밀번호에서 발급합니다.
# Microsoft 365 는 smtp.office365.com:587 입니다.
# 사내 SMTP 릴레이로 옮길 때도 코드는 그대로고 아래 값만 바꾸면 됩니다.
#
# SMTP_PASS 도 비밀입니다 — service_role 키와 같이 플랫폼 환경변수 화면에
# 두는 편이 안전합니다.
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# 메일 본문 링크의 기준 주소. 사용자가 브라우저에 치는 주소 그대로 넣습니다
# (예: https://moa.eland.co.kr). 비우면 메일에 링크가 빠집니다.
APP_BASE_URL=
`;
}

// 로컬 .env.local 에서 비밀 아닌 값만 골라 읽는다. service_role 은 읽지 않는다 —
// 실수로 파일에 흘려 넣을 경로를 아예 만들지 않는다.
async function readPublicEnv() {
  const raw = await readFile(path.join(root, '.env.local'), 'utf8').catch(() => {
    fail('.env.local 이 없습니다. --with-env 는 여기서 공개 값을 읽어옵니다.');
  });
  const get = (key) => {
    const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() : '';
  };
  const publicUrl = get('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const serverUrl = get('SUPABASE_URL') || publicUrl;
  // 로컬에 없으면 코드의 기본값과 같은 값을 쓴다(app/api/signup/route.js).
  // 빈 문자열로 내보내면 가입이 전부 막히므로 절대 비워 두지 않는다.
  const signupDomains = get('SIGNUP_ALLOWED_DOMAINS') || 'eland.co.kr';
  if (!publicUrl || !anonKey) {
    fail('.env.local 에 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.');
  }
  return { publicUrl, anonKey, serverUrl, signupDomains };
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

  const withEnv = process.argv.includes('--with-env');

  console.log('3/4 배포 안내 작성');
  await writeFile(path.join(stage, '.env.local.example'), SOURCE_ENV_EXAMPLE, 'utf8');
  await writeFile(path.join(stage, '배포안내.md'), sourceGuide(name, withEnv), 'utf8');
  if (withEnv) {
    const values = await readPublicEnv();
    await writeFile(path.join(stage, '.env.local'), envFileBody(values), 'utf8');
    console.log(`    - .env.local 넣음 (${values.publicUrl})`);
    console.log(
      `      NEXT_PUBLIC 2개 + SUPABASE_URL + SIGNUP_ALLOWED_DOMAINS(${values.signupDomains}) 채움`,
    );
    console.log('      service_role 만 비움');
  }

  console.log('4/4 압축');
  await rm(zip, { force: true });
  await compress(stage, zip);

  // 압축이 끝난 뒤 한 번 더 훑는다. 앞 단계에서 무엇이 들어갔든 여기서
  // 최종 판정한다 — 통과했다고 믿고 넘어가는 것이 제일 위험하다.
  const allowed = withEnv ? ['.env.local.example', '.env.local'] : ['.env.local.example'];
  const stray = await findEnvFiles(stage, allowed);
  if (stray.length > 0) fail(`ZIP 에 예상하지 못한 env 파일이 들어갔습니다: ${stray.join(', ')}`);
  if (withEnv) {
    // 파일 안에 service_role 키가 채워져 있는지도 본다. --with-env 는 비워
    // 두지만, 누군가 dist/ 의 스테이지 폴더를 손으로 고친 뒤 다시 압축할 수 있다.
    const body = await readFile(path.join(stage, '.env.local'), 'utf8');
    const filled = /^SUPABASE_SERVICE_ROLE_KEY=.+$/m.test(body);
    console.log(
      filled
        ? '    - 주의: .env.local 에 service_role 키가 채워져 있습니다. 배포 후 재발급을 권합니다.'
        : '    - service_role 키 비어 있음 확인 (플랫폼 환경변수로 넣으세요)',
    );
  } else {
    console.log('    - .env.local 없음 확인');
  }

  const { size } = await stat(zip);
  console.log(`\n완료: dist/${path.basename(zip)} (${(size / 1024 / 1024).toFixed(1)} MB)`);
  console.log('플랫폼이 install + build 를 실행하는 배포용입니다.');
  console.log(
    withEnv
      ? '플랫폼 환경변수에 넣을 것: SUPABASE_SERVICE_ROLE_KEY, HOSTNAME=0.0.0.0, PORT\n'
      : '환경변수 4개를 빌드 전에 넣어야 합니다 — ZIP 안의 배포안내.md 참고.\n',
  );
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
  console.log('풀어서 `node server.js` 로 실행합니다. 자세한 건 ZIP 안의 배포안내.md.');
  console.log(BUILT_MODE_WARNING);
}

// 이 경고가 있는 이유.
//
// 이 모드가 맞는 곳과 틀린 곳이 겉으로 구분되지 않는다. 둘 다 "ZIP 을 올리세요"
// 라고만 말한다. 파일 맨 위 주석에 그 구분이 적혀 있었는데도 이 실패를 두 번
// 냈다 — 주석은 스크립트를 실행하는 사람 눈앞에 없기 때문이다. 그래서 실행할
// 때마다 화면에 찍는다.
//
// 실패 모양까지 적어 두는 게 핵심이다. 로그에서 이 줄을 보고 여기로 돌아올 수
// 있어야 한다. 실제 로그(2026-08-13)는 이랬다:
//   npx --yes @opennextjs/aws@3 build  →  exit status 1   (16초 만에)
// standalone 결과물에는 app/ 도 next.config.mjs 도 없는데 package.json 의
// "build": "next build" 는 그대로 남아 있어서, 플랫폼이 그 스크립트를 믿고
// 빌드를 돌리다 소스를 못 찾고 죽는다.
const BUILT_MODE_WARNING = `
────────────────────────────────────────────────────────────────
 이 ZIP 은 "빌드 완료본" 입니다.

 Node 가 설치된 서버에 올려 직접 \`node server.js\` 로 띄울 때만 맞습니다.

 ZIP 을 올리면 알아서 빌드해 주는 플랫폼(noa-vibe 등)이라면 이걸
 올리면 실패합니다. 소스가 없어서 빌드가 돌지 않기 때문입니다.
 그 경우 아래로 다시 만드세요:

     npm run package:src

 실패 신호 — 배포 로그에 이 줄이 보이면 모드를 잘못 고른 것입니다:
     npx --yes @opennextjs/aws@3 build ... exit status 1
     Phase complete: BUILD State: FAILED
────────────────────────────────────────────────────────────────
`;

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

# 주간 요약 메일을 부르는 스케줄러가 쓸 토큰(선택).
#
# 비우면 /api/cron/weekly-digest 가 503 으로 잠깁니다 — 없을 때 통과시키면
# "설정을 깜빡한 서버"가 곧 "누구나 메일을 쏠 수 있는 서버"가 됩니다.
# 아무 긴 임의 문자열이면 됩니다: openssl rand -hex 32
CRON_SECRET=
`;

function sourceGuide(name, withEnv) {
  const envSection = withEnv
    ? `## 환경변수 — 플랫폼에 넣을 것은 **하나**입니다

이 ZIP 에는 \`.env.local\` 이 들어 있고, 비밀이 아닌 네 값이 이미 채워져
있습니다 — \`NEXT_PUBLIC_SUPABASE_URL\`, \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`,
\`SUPABASE_URL\`, \`SIGNUP_ALLOWED_DOMAINS\`.
앞의 셋은 빌드하면 브라우저 코드에 박히거나 그와 같은 값이라 숨길 수 있는
값이 아니고, 마지막은 가입 허용 도메인이라 정책값입니다.

플랫폼 환경변수 화면에는 아래만 넣으세요.

| 이름 | 값 |
|---|---|
| \`SUPABASE_SERVICE_ROLE_KEY\` | service_role 키 |
| \`HOSTNAME\` | \`0.0.0.0\` |
| \`PORT\` | 플랫폼이 지정한 포트 (없으면 \`3000\`) |

\`SUPABASE_SERVICE_ROLE_KEY\` 를 \`.env.local\` 에 직접 적어도 동작합니다.
다만 이 키만 RLS 를 우회하므로 DB 전체가 열리는 값입니다. ZIP 은 배포 도구
저장소에 남고 다시 내려받게 되므로, 이 한 줄은 파일 밖에 두는 편이 안전합니다.
파일에 적으셨다면 배포 후 Supabase 에서 재발급하시기를 권합니다.

\`KEEP_ALIVE_TIMEOUT\`, \`NODE_ENV\`, \`__NEXT_PRIVATE_STANDALONE_CONFIG\` 는
비워 두거나 삭제하세요. 마지막 것은 Next 내부 변수라 값을 넣으면 앱이 깨집니다.`
    : `## 환경변수 (네 개, 빌드 전에 넣어야 함)

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
함께 주세요.`;

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

${envSection}

## 확인 (순서대로)
1. \`/login\` 이 **모양을 갖춘 채로** 열린다 → 빌드/정적파일 정상
2. \`/api/signup/brands\` 가 브랜드 목록 JSON 을 돌려준다 → DB 연결 정상
   (500 이면 \`SUPABASE_URL\` / \`SUPABASE_SERVICE_ROLE_KEY\` 확인)
3. 로그인하면 요구사항 목록이 뜬다 → 끝
   (여기서만 실패하면 \`NEXT_PUBLIC_\` 두 개를 빌드 전에 안 넣은 것입니다)

## 주간 요약 메일 (선택)

매주 월요일 아침, 브랜드의 실무자 이상에게 "이번 주 손볼 것"을 메일로
보냅니다. 담당자 없는 검토대기, 예상일 없는 진행 건, 레드마인 미연결,
그리고 받는 사람 본인의 지연 건입니다. 손볼 것이 없으면 보내지 않습니다.

켜려면 두 가지가 필요합니다.

1. 환경변수 \`CRON_SECRET\` 에 임의의 긴 문자열을 넣습니다.
2. 스케줄러가 매주 월요일 아침에 아래를 호출하게 합니다.

\`\`\`
curl -X POST https://<주소>/api/cron/weekly-digest \\
  -H "Authorization: Bearer <CRON_SECRET>"
\`\`\`

부르는 주체는 무엇이든 됩니다 — 배포 플랫폼의 스케줄러, Supabase 의
pg_cron, 사내 배치 서버, 사람이 직접 실행하는 것까지.

응답에 몇 통이 나갔는지가 담깁니다. 화면에 아무도 없는 작업이라 이 응답이
유일한 단서입니다.

\`\`\`
{"ok":true,"brands":1,"sent":4,"skipped":0,"failed":0}
\`\`\`

- \`skipped\` — 메일 주소가 없거나 그 사람에게 손볼 것이 없었던 경우
- \`401\` — 토큰 불일치 · \`503\` — \`CRON_SECRET\` 미설정(잠긴 상태)

\`CRON_SECRET\` 을 안 넣으면 이 기능만 꺼지고 나머지는 전부 그대로 동작합니다.
`;
}

function guide(name) {
  return `# 모아 MOA 배포 안내 (${name})

> **이 ZIP 은 빌드 완료본입니다.** Node 가 설치된 서버에 올려 직접
> \`node server.js\` 로 띄울 때만 맞습니다.
>
> ZIP 을 올리면 알아서 빌드해 주는 플랫폼(noa-vibe 등)에는 이걸 올리면
> 실패합니다 — 이 안에는 \`app/\` 도 \`next.config.mjs\` 도 없어서 빌드가
> 돌지 않습니다. 그 경우 \`npm run package:src\` 로 만든 **소스 ZIP** 을
> 쓰세요.

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
