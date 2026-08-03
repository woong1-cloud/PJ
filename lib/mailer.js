import 'server-only';
import nodemailer from 'nodemailer';

// SMTP 발송기.
//
// 어느 SMTP 를 쓸지는 이 파일이 모른다 — 전부 환경변수다. Gmail 로 시작해서
// 나중에 사내 릴레이로 옮겨도 여기 코드는 한 줄도 안 바뀌고 값만 바뀐다.
// 이게 지금 Gmail 로 시작해도 되는 이유다.
//
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=587
//   SMTP_USER=보내는계정@...
//   SMTP_PASS=앱 비밀번호
//   SMTP_FROM=모아 MOA <보내는계정@...>
//   APP_BASE_URL=https://사내주소
//
// 하나라도 비어 있으면 메일 기능은 통째로 꺼진다(끄는 스위치가 따로 없다).
// 개발 중에 실수로 진짜 메일이 나가는 일도 이 규칙이 막는다.

function config() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  // ?? 를 쓰면 안 된다. 배포 플랫폼의 환경변수 화면은 비워 둔 항목을 빈
  // 문자열로 넘기는데, ?? 는 nullish 일 때만 기본값으로 떨어진다. 그러면
  // Number('') 가 0 이 되어 포트 0 으로 접속을 시도하고, 원인을 알 수 없는
  // 연결 실패가 난다. SIGNUP_ALLOWED_DOMAINS 에서 이미 겪은 함정이다.
  const port = Number(process.env.SMTP_PORT || 587);

  return {
    host,
    port,
    // 465 는 처음부터 TLS, 587 은 STARTTLS 다. 이걸 반대로 잡으면 연결이
    // 그냥 멈춘 채 타임아웃까지 간다 — 오류 메시지가 가장 불친절한 구간이다.
    secure: port === 465,
    auth: { user, pass },
    // 빈 문자열이면 인증 계정을 그대로 쓴다. 빈 발신자로 보내면 SMTP 서버가
    // 거절한다.
    from: process.env.SMTP_FROM || user,
  };
}

export function isMailEnabled() {
  return config() !== null;
}

// 앱의 바깥 주소. 메일 본문 링크에 쓴다.
//
// 알아낼 방법이 없어서 환경변수로 받는다. 요청 헤더의 Host 를 쓰면 프록시
// 뒤에서 내부 호스트명이 잡혀 아무도 못 여는 링크가 만들어진다.
export function appBaseUrl() {
  return process.env.APP_BASE_URL ?? null;
}

let transport = null;
// 설정이 없다는 경고를 매번 찍으면 로그가 그 줄로 도배된다. 한 번만 알린다.
let warned = false;

function getTransport() {
  const cfg = config();
  if (!cfg) {
    if (!warned) {
      warned = true;
      console.warn('SMTP 미설정 — 알림 메일을 보내지 않습니다(인앱 알림은 그대로 동작).');
    }
    return null;
  }
  if (!transport) {
    transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.auth,
      // 기본값(2분)을 그대로 두면 안 된다. 라우트가 이 발송을 기다리기 때문에
      // 방화벽이 587 을 조용히 버리는 경우 사용자가 2분간 저장 버튼을 보고
      // 있게 된다. 짧게 끊고 실패로 처리하는 편이 낫다 — 인앱 알림은 이미 갔다.
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
    });
  }
  return transport;
}

// 메일 한 통. 이 함수는 절대 throw 하지 않는다.
//
// lib/notify.js 와 같은 규약이다. 메일이 안 나갔다고 "상태 변경 실패" 를 보게
// 되면 그 메시지는 거짓말이고, 사용자는 되지도 않는 재시도를 한다. 게다가
// SMTP 는 느리고 자주 흔들린다 — 앱의 응답 시간이 남의 메일 서버에 묶이면
// 안 된다.
export async function sendMail({ to, subject, text }) {
  try {
    const t = getTransport();
    if (!t) return false;
    if (!to) return false;
    await t.sendMail({ from: config().from, to, subject, text });
    return true;
  } catch (error) {
    // 계정 정보는 절대 찍지 않는다. 메시지와 코드만으로 원인은 충분히 좁혀진다
    // (EAUTH=인증 실패, ETIMEDOUT=포트 막힘, ENOTFOUND=호스트 오타).
    console.error('알림 메일 발송 실패', error?.message ?? error, error?.code ?? '');
    return false;
  }
}

// 여러 명에게 같은 메일. 한 명이 실패해도 나머지는 간다.
//
// to 에 전부 몰아넣지 않는다 — 받는 사람들끼리 서로의 주소가 보이고, 한 명의
// 주소가 잘못돼 있으면 전체가 반송된다.
export async function sendMailToMany(recipients, mail) {
  const list = (recipients ?? []).filter(Boolean);
  if (list.length === 0) return 0;
  const results = await Promise.all(list.map((to) => sendMail({ ...mail, to })));
  return results.filter(Boolean).length;
}
