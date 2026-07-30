// SMTP 설정이 실제로 되는지 확인하는 스크립트.
//
//   npm run mail:test -- 받는사람@eland.co.kr
//
// 앱을 띄우지 않고 .env.local 만 읽어 한 통 보낸다. 배포한 뒤에 "메일이 안
// 오는데요"부터 시작하면 원인 후보가 앱·환경변수·방화벽·계정으로 넷이 된다.
// 여기서 먼저 걸러 두면 앱 쪽만 남는다.
//
// 진짜 메일이 나간다. 받는 주소는 인자로 직접 적어야 하고 기본값은 없다.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';

const root = process.cwd();
const to = process.argv[2];

if (!to) {
  console.error('받는 주소가 필요합니다:  npm run mail:test -- 받는사람@eland.co.kr');
  process.exit(1);
}

const raw = await readFile(path.join(root, '.env.local'), 'utf8').catch(() => {
  console.error('.env.local 이 없습니다.');
  process.exit(1);
});

const env = {};
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const host = env.SMTP_HOST;
const user = env.SMTP_USER;
const pass = env.SMTP_PASS;
const port = Number(env.SMTP_PORT || 587);

if (!host || !user || !pass) {
  console.error('SMTP_HOST / SMTP_USER / SMTP_PASS 를 .env.local 에 먼저 채워 주세요.');
  process.exit(1);
}

// 비밀번호는 절대 찍지 않는다. 어느 계정으로 붙는지만 보여준다.
console.log(`${host}:${port} 에 ${user} 로 접속합니다...`);

const transport = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
});

try {
  await transport.verify();
  console.log('접속·인증 성공');
} catch (error) {
  console.error('접속 실패:', error?.message ?? error, error?.code ?? '');
  // 원인별로 볼 곳이 다르다. 여기서 갈라 주지 않으면 대부분 앱 코드를 먼저 뒤진다.
  console.error(
    [
      '',
      'EAUTH        → 계정/앱 비밀번호 문제. Gmail 은 2단계 인증 후 발급한 앱 비밀번호여야 합니다.',
      'ETIMEDOUT    → 이 컴퓨터(또는 서버)에서 해당 포트로 나가는 길이 막혀 있습니다. 방화벽 확인.',
      'ENOTFOUND    → SMTP_HOST 오타.',
      'ESOCKET/SSL  → 포트와 secure 불일치. 465 는 SSL, 587 은 STARTTLS 입니다.',
    ].join('\n')
  );
  process.exit(1);
}

const info = await transport.sendMail({
  from: env.SMTP_FROM || user,
  to,
  subject: '[모아 MOA] SMTP 발송 테스트',
  text: [
    '이 메일이 보이면 알림 메일 설정이 끝난 것입니다.',
    '',
    `발신: ${env.SMTP_FROM || user}`,
    `서버: ${host}:${port}`,
    '',
    '스팸함으로 갔다면 발신 주소를 사내 도메인 계정으로 바꾸는 것을 검토하세요.',
  ].join('\n'),
});

console.log(`발송 완료 → ${to}`);
console.log(`messageId: ${info.messageId}`);
console.log('받은편지함과 스팸함을 모두 확인해 주세요.');
