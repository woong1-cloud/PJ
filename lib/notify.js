import 'server-only';
import { getSupabaseAdmin } from './supabaseAdmin';
import {
  assigneeMessage,
  commentMessage,
  commentRecipients,
  mentionMessage,
  resolveRecipients,
  signupMessage,
  statusMessage,
} from './notifications';
import { parseMentions } from './mentions';
import { loadMentionableMembers } from './mentionable';
import { appBaseUrl, sendMail, sendMailToMany } from './mailer';
import { assigneeEmail, mentionEmail, signupEmail } from './emailContent';

// 인앱 알림 생성. 상태 변경·코멘트·담당자 지정 라우트가 자기 일을 끝낸 뒤
// 마지막에 한 줄로 부른다.
//
// 여기서 나는 모든 오류는 삼킨다. 알림은 부가 기능이고, 알림 insert 가 실패했다고
// 사용자가 '상태 변경 실패' 를 보게 되면 안 된다 — 상태는 이미 바뀌었기 때문에
// 그 메시지는 거짓말이고, 사용자는 되지도 않는 재시도를 하게 된다.
// 그래서 이 파일의 모든 export 는 절대 throw 하지 않고 await 실패도 없다.
//
// 수신자 판정(본인 제외·중복 제거)은 lib/notifications.js 의 순수 함수가 한다.

// 요구사항의 현재 요청자/담당자와, 문구에 쓸 이름들을 한 번에 가져온다.
//
// 라우트가 이미 들고 있는 행을 넘겨받지 않고 다시 읽는 이유: 라우트마다 select
// 컬럼이 제각각이라 어떤 곳은 requester 가, 어떤 곳은 title 이 없다. 부르는
// 쪽에서 컬럼을 맞추게 하면 언젠가 하나를 빠뜨리고, 그 라우트만 조용히 알림이
// 안 간다. 조회 한 번 더 하는 값으로 그 실패 방식을 없앤다.
//
// embed 를 쓰지 않고 team_members 를 따로 읽는다. requirements → team_members
// 경로가 requester/assignee 둘이라 embed 는 FK 를 명시해야 하고(PGRST201),
// 여기서는 이름 몇 개만 있으면 되므로 in() 한 번이 더 단순하다.
async function loadContext(requirementId, extraMemberIds = []) {
  const supabase = getSupabaseAdmin();

  // brand_id·is_confidential 은 멘션이 쓴다. 부를 수 있는 사람을 그 요구사항의
  // 브랜드로 좁히려면 여기서 같이 읽어와야 한다.
  const { data: requirement, error } = await supabase
    .from('requirements')
    .select('id, title, requester, assignee, brand_id, is_confidential')
    .eq('id', requirementId)
    .maybeSingle();
  if (error) throw error;
  if (!requirement) return null;

  const ids = [...new Set([...extraMemberIds].filter(Boolean))];
  const names = new Map();
  if (ids.length > 0) {
    const { data: members, error: memberError } = await supabase
      .from('team_members')
      .select('id, name')
      .in('id', ids);
    if (memberError) throw memberError;
    for (const member of members ?? []) names.set(member.id, member.name);
  }

  return { supabase, requirement, names };
}

// 메일 주소 조회.
//
// loadMentionableMembers 를 고쳐 email 을 함께 받지 않는다. 그 함수의 결과는
// 자동완성 API 를 통해 브라우저로도 나가는데, 거기에 전사 메일 주소가 실리면
// 알림 하나 붙이려다 주소록을 공개하는 꼴이 된다. 서버 안에서만 쓰는 조회를
// 따로 둔다.
async function loadEmails(supabase, memberIds) {
  const ids = [...new Set((memberIds ?? []).filter(Boolean))];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from('team_members')
    .select('id, name, email, auth_user_id')
    .in('id', ids)
    .eq('is_active', true);
  if (error) throw error;

  // 계정은 있는데 주소가 비어 있으면 메일이 조용히 안 간다. 이 상태는 화면
  // 어디에도 안 보이므로(벨은 정상적으로 뜬다) 로그가 유일한 단서다.
  // 0016 이 기존 데이터를 메웠으니 여기 걸리는 사람이 있으면 새로 생긴 것이다.
  for (const m of data ?? []) {
    if (!m.email && m.auth_user_id) {
      console.warn(`알림 메일 건너뜀 — ${m.name}(${m.id}) 에 메일 주소가 없습니다.`);
    }
  }

  return new Map((data ?? []).filter((m) => m.email).map((m) => [m.id, m.email]));
}

async function insertNotificationRows(supabase, rows) {
  if (rows.length === 0) return;
  let { error } = await supabase.from('in_app_notifications').insert(rows);
  // 42703 = undefined_column. 0015 미적용 DB에서는 link 만 빼고 넣는다.
  // 배포가 마이그레이션보다 먼저 올라간 몇 분 동안 알림이 통째로 안 가는
  // 것보다, 눌러도 안 움직이는 알림이 낫다. 0015 적용 후 지워도 되는 분기다.
  if (error?.code === '42703' && rows.some((r) => 'link' in r)) {
    const withoutLink = rows.map(({ link: _dropped, ...rest }) => rest);
    ({ error } = await supabase.from('in_app_notifications').insert(withoutLink));
  }
  if (error) throw error;
}

async function insertNotifications(supabase, requirementId, recipients, message) {
  await insertNotificationRows(
    supabase,
    recipients.map((teamMemberId) => ({
      team_member_id: teamMemberId,
      requirement_id: requirementId,
      message,
    }))
  );
}

// 삼킨 오류를 로그로 남기는 유일한 통로.
//
// error 를 그대로 넘기면 안 된다 — Supabase 의 PostgrestError 는 Error 인스턴스가
// 아니라 평범한 객체라, 서버 로거가 구조화하면서 '{}' 로 찍힌다. 실제로 이 코드를
// 일부러 깨뜨려 확인했을 때 로그에 '알림 생성 실패(상태 변경) {}' 만 남았다.
// 오류를 삼키기로 한 이상, 로그마저 비어 있으면 문제를 알아챌 방법이 없다.
function logFailure(where, error) {
  console.error(`알림 생성 실패(${where})`, error?.message ?? error, error?.code ?? '');
}

// 상태 변경(반려·취소 포함) 알림.
export async function notifyStatusChange({ requirementId, actorId, status }) {
  try {
    const context = await loadContext(requirementId, [actorId]);
    if (!context) return;
    const { supabase, requirement, names } = context;
    const recipients = resolveRecipients(requirement, actorId);
    const message = statusMessage(names.get(actorId), requirement.title, status);
    await insertNotifications(supabase, requirementId, recipients, message);
  } catch (error) {
    logFailure('상태 변경', error);
  }
}

// 코멘트 등록 알림. 본문에서 불린 사람(@멘션)까지 함께 받는다.
//
// 본문 해석은 화면이 보낸 이름 목록이 아니라 서버가 다시 만든 목록으로 한다.
// 입력창의 자동완성은 편의일 뿐이고, 여기가 관문이다 — 그 브랜드 팀이 아닌
// 사람 이름을 손으로 적어 넣어도 그 이름은 목록에 없으므로 아무 일도 안 난다.
//
// body 를 안 넘기면 예전 그대로(요청자·담당자에게만) 동작한다.
export async function notifyComment({ requirementId, actorId, body }) {
  try {
    const context = await loadContext(requirementId, [actorId]);
    if (!context) return;
    const { supabase, requirement, names } = context;

    let mentionedIds = [];
    if (typeof body === 'string' && body.includes('@')) {
      const mentionable = await loadMentionableMembers(supabase, {
        brandId: requirement.brand_id,
        isConfidential: requirement.is_confidential,
      });
      mentionedIds = parseMentions(body, mentionable).map((m) => m.id);
    }

    const recipients = commentRecipients(requirement, actorId, mentionedIds);
    const actorName = names.get(actorId);
    // 불려서 온 알림과 그냥 코멘트 알림은 눌러야 할 이유가 다르다. 한 사람에게
    // 두 줄이 가지 않도록 수신자는 이미 합쳐져 있고, 문구만 갈라 붙인다.
    const forComment = commentMessage(actorName, requirement.title);
    const forMention = mentionMessage(actorName, requirement.title);
    await insertNotificationRows(
      supabase,
      recipients.map((r) => ({
        team_member_id: r.id,
        requirement_id: requirementId,
        message: r.mentioned ? forMention : forComment,
      }))
    );

    // 메일은 불린 사람에게만. 일반 코멘트까지 메일로 내보내면 활발한 요구사항
    // 하나가 하루에 열 통을 만든다 — 이름이 불린 것은 "당신 답을 기다린다"는
    // 뜻이라 성격이 다르다.
    const mentionedRecipients = recipients.filter((r) => r.mentioned).map((r) => r.id);
    if (mentionedRecipients.length > 0) {
      const emails = await loadEmails(supabase, mentionedRecipients);
      await sendMailToMany(
        mentionedRecipients.map((id) => emails.get(id)),
        mentionEmail({
          title: requirement.title,
          actorName,
          requirementId,
          baseUrl: appBaseUrl(),
        })
      );
    }
  } catch (error) {
    logFailure('코멘트', error);
  }
}

// 담당자 지정 알림. 반드시 update 뒤에 부른다 — 새 담당자가 수신자에 들어가야
// 하는데 그 정보는 갱신된 행에만 있다.
//
// 담당자를 비우는 경우는 알리지 않는다. 알림의 범위는 "새로 걸린 사람"이고,
// 풀린 사람에게 보낼 메시지는 벨에서 눌러도 할 일이 없다.
export async function notifyAssigneeChange({ requirementId, actorId, assigneeId }) {
  try {
    if (!assigneeId) return;
    const context = await loadContext(requirementId, [actorId, assigneeId]);
    if (!context) return;
    const { supabase, requirement, names } = context;
    const recipients = resolveRecipients(requirement, actorId);
    const message = assigneeMessage(
      names.get(actorId),
      requirement.title,
      names.get(assigneeId)
    );
    await insertNotifications(supabase, requirementId, recipients, message);

    // 메일은 새 담당자 본인에게만 간다. 인앱 알림은 요청자에게도 가지만,
    // 요청자가 이 시점에 할 일은 없다 — 한 사건에 두 통이 되면 그때부터
    // 사람들은 이 메일을 규칙으로 걸러 버린다.
    //
    // 자기가 자기를 지정한 경우는 보내지 않는다(resolveRecipients 와 같은 규칙).
    if (assigneeId !== actorId) {
      const emails = await loadEmails(supabase, [assigneeId]);
      await sendMail({
        to: emails.get(assigneeId),
        ...assigneeEmail({
          title: requirement.title,
          assignerName: names.get(actorId),
          requirementId,
          baseUrl: appBaseUrl(),
        }),
      });
    }
  } catch (error) {
    logFailure('담당자 지정', error);
  }
}

// 가입 신청(배치 대기) 알림.
//
// 다른 알림과 성격이 다르다. 나머지는 "당신 건에 무슨 일이 있었다"이고 이건
// "당신이 처리해야 할 일이 생겼다"이다. 배치는 /admin/members 에서만 하고 그
// 화면은 전체 관리자 전용이라, 받을 사람도 전체 관리자 전원이다.
//
// 브랜드 관리자에게는 보내지 않는다. 지금 배치 화면 자체가 전체 관리자
// 전용이라 알림을 받아도 갈 곳이 없다 — 알림이 막다른 길이 되면 그 다음부터
// 아무도 벨을 안 본다.
//
// 이 함수는 비로그인 사용자가 호출하는 가입 라우트에서 불린다. 하지만 인자로
// 받은 값 중 어느 것도 권한이 되지 않고, 수신자는 DB 의 is_global_admin 으로만
// 정해진다 — 가입 폼에 뭘 적든 받는 사람은 바뀌지 않는다.
export async function notifySignup({ name, affiliation, brandName }) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: admins, error } = await supabase
      .from('team_members')
      .select('id, email')
      .eq('is_global_admin', true)
      .eq('is_active', true);
    if (error) throw error;

    const message = signupMessage(name, affiliation, brandName);
    await insertNotificationRows(
      supabase,
      (admins ?? []).map((admin) => ({
        team_member_id: admin.id,
        requirement_id: null,
        message,
        link: '/admin/members',
      }))
    );

    // 배치 대기는 메일까지 보낸다. 가입한 사람은 배치될 때까지 로그인해도
    // 할 수 있는 일이 없어서, 관리자가 벨을 볼 때까지 그냥 기다린다.
    await sendMailToMany(
      (admins ?? []).map((admin) => admin.email),
      signupEmail({ name, affiliation, brandName, baseUrl: appBaseUrl() })
    );
  } catch (error) {
    logFailure('가입 신청', error);
  }
}
