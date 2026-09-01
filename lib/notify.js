import 'server-only';
import { getSupabaseAdmin } from './supabaseAdmin';
import {
  assigneeMessage,
  commentMessage,
  commentRecipients,
  mentionMessage,
  resolveRecipients,
  shouldRetryWithoutLink,
  signupMessage,
  statusMessage,
  submitMessage,
  submitRecipients,
} from './notifications';
import { parseMentions } from './mentions';
import { loadMentionableMembers } from './mentionable';
import { appBaseUrl, sendMail, sendMailToMany } from './mailer';
import {
  assignedBatchEmail,
  askEmail,
  assigneeEmail,
  feedbackEmail,
  meetingDigestEmail,
  mentionEmail,
  signupEmail,
  submittedEmail,
  weeklyDigestEmail,
} from './emailContent';
import { buildWeeklyDigest, digestSummaryLine } from './weeklyDigest';
import { buildMeetingDigest } from './meetingDigest';
import { todayInKst } from './overdue';

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
  // 0015(link 컬럼) 미적용 DB에서는 link 만 빼고 넣는다. 배포가 마이그레이션보다
  // 먼저 올라간 동안 알림이 통째로 안 가는 것보다, 눌러도 안 움직이는 알림이 낫다.
  //
  // 판정은 shouldRetryWithoutLink 가 한다 — 어떤 오류 코드를 봐야 하는지에서
  // 실제로 틀렸던 자리라 순수 함수로 빼서 테스트를 걸었다.
  if (shouldRetryWithoutLink(error, rows)) {
    const withoutLink = rows.map(({ link: _dropped, ...rest }) => rest);
    ({ error } = await supabase.from('in_app_notifications').insert(withoutLink));
  }
  if (error) throw error;
}

// 인앱과 메일을 서로 떼어 놓는 실행기.
//
// 예전에는 두 통로가 한 try 안에 나란히 있었다. 그래서 인앱 insert 가 던지면
// 그 뒤의 메일 발송은 아예 실행되지 않았다 — 가입 알림이 인앱도 메일도 통째로
// 사라진 것이 정확히 이 구조 때문이다.
//
// 알림은 여러 통로로 같은 사실을 알리는 기능이고, 한 통로가 막혔다고 다른
// 통로까지 막을 이유가 없다.
async function runQuietly(where, task) {
  try {
    await task();
  } catch (error) {
    logFailure(where, error);
  }
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
export async function notifyStatusChange({ requirementId, actorId, status, reason }) {
  try {
    const context = await loadContext(requirementId, [actorId]);
    if (!context) return;
    const { supabase, requirement, names } = context;
    const recipients = resolveRecipients(requirement, actorId);
    const message = statusMessage(names.get(actorId), requirement.title, status, reason);
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
    await runQuietly('코멘트 인앱', () =>
      insertNotificationRows(
        supabase,
        recipients.map((r) => ({
          team_member_id: r.id,
          requirement_id: requirementId,
          message: r.mentioned ? forMention : forComment,
        }))
      )
    );

    // 메일은 불린 사람에게만. 일반 코멘트까지 메일로 내보내면 활발한 요구사항
    // 하나가 하루에 열 통을 만든다 — 이름이 불린 것은 "당신 답을 기다린다"는
    // 뜻이라 성격이 다르다.
    const mentionedRecipients = recipients.filter((r) => r.mentioned).map((r) => r.id);
    if (mentionedRecipients.length > 0) {
      await runQuietly('멘션 메일', async () => {
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
      });
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
    await runQuietly('담당자 지정 인앱', () =>
      insertNotifications(supabase, requirementId, recipients, message)
    );

    // 메일은 새 담당자 본인에게만 간다. 인앱 알림은 요청자에게도 가지만,
    // 요청자가 이 시점에 할 일은 없다 — 한 사건에 두 통이 되면 그때부터
    // 사람들은 이 메일을 규칙으로 걸러 버린다.
    //
    // 자기가 자기를 지정한 경우는 보내지 않는다(resolveRecipients 와 같은 규칙).
    if (assigneeId !== actorId) {
      await runQuietly('담당자 지정 메일', async () => {
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
      });
    }
  } catch (error) {
    logFailure('담당자 지정', error);
  }
}

// 접수(검토 요청) 알림.
//
// 요구사항이 '검토대기'로 올라온 순간 그 브랜드의 3차 이상에게 알린다.
// 등록하면서 바로 제출한 경우와 작성중이던 것을 나중에 올린 경우 둘 다 부른다.
//
// 이 함수가 생기기 전에는 두 길 모두 아무에게도 안 갔다. 등록 라우트에는 알림
// 호출 자체가 없었고, 제출 라우트는 notifyStatusChange 를 불렀지만 그 수신자는
// 요청자(=행위자라 제외)와 담당자(제출 시점에는 없음)뿐이라 늘 0명이었다.
// 34건이 그렇게 쌓였다.
//
// notifyStatusChange 를 재사용하지 않고 따로 두는 이유가 그것이다. 저쪽의
// "개인적으로 걸려 있는 사람에게만"은 나머지 상태 변경에는 맞는 규칙이다 —
// 여기만 예외라서, 저쪽을 고치면 반려·완료 알림까지 브랜드 전체로 퍼진다.
export async function notifySubmitted({ requirementId, actorId, brandId }) {
  try {
    const context = await loadContext(requirementId, [actorId]);
    if (!context) return;
    const { supabase, requirement, names } = context;

    // 브랜드는 인자로 받은 값이 아니라 요구사항의 것을 쓴다. 부르는 쪽이
    // 넘긴 brandId 는 이미 라우트가 검증했지만, 여기서 한 번 더 요구사항
    // 기준으로 좁히면 "다른 브랜드 사람에게 알림이 갔다"가 구조적으로 불가능해진다.
    const targetBrandId = requirement.brand_id ?? brandId;
    if (!targetBrandId) return;

    const { data: roles, error: rolesError } = await supabase
      .from('user_brand_roles')
      .select('team_member_id, tier')
      .eq('brand_id', targetBrandId);
    if (rolesError) throw rolesError;

    const recipients = submitRecipients(roles ?? [], actorId);
    // 3차 이상이 아무도 없는 브랜드면 조용히 끝낸다. 보낼 곳이 없는 것이지
    // 오류가 아니다.
    if (recipients.length === 0) return;

    const actorName = names.get(actorId);
    const message = submitMessage(actorName, requirement.title);

    await runQuietly('접수 인앱', () =>
      insertNotifications(supabase, requirementId, recipients, message)
    );

    // 메일도 보낸다. 벨은 로그인해야 보이는데, 접수를 못 본 채로 며칠이
    // 지나는 것이 지금 실제로 일어나고 있는 일이다.
    //
    // 비활성 계정과 메일 주소 없는 계정은 loadEmails 가 걸러 낸다.
    await runQuietly('접수 메일', async () => {
      const emails = await loadEmails(supabase, recipients);
      if (emails.size === 0) return;
      // 브랜드 이름은 메일 제목에만 쓴다. 없으면 제목에서 빠질 뿐이라
      // 조회가 실패해도 메일은 나간다.
      const { data: brand } = await supabase
        .from('brands')
        .select('name')
        .eq('id', targetBrandId)
        .maybeSingle();
      await sendMailToMany(
        recipients.map((id) => emails.get(id)),
        submittedEmail({
          title: requirement.title,
          requesterName: actorName,
          brandName: brand?.name,
          requirementId,
          baseUrl: appBaseUrl(),
        })
      );
    });
  } catch (error) {
    logFailure('접수', error);
  }
}

// 주간 요약 메일. 스케줄러가 /api/cron/weekly-digest 로 부른다.
//
// 인앱 알림은 만들지 않는다. 벨은 "방금 무슨 일이 있었다"를 위한 자리이고,
// 주간 요약이 말하는 "쌓여 있다"는 이미 대시보드가 늘 보여주고 있다. 벨에
// 대시보드로 가는 줄을 주 1회 넣으면 그건 없는 화면으로 가는 길이 아니라
// 이미 있는 화면으로 가는 중복이다.
//
// 브랜드마다 돌고, 브랜드 안에서 사람마다 다른 본문을 만든다(내 담당 지연이
// 맨 위에 오므로 한 통을 여럿에게 보낼 수 없다). 스파오 4명 기준 주 4통이다.
//
// 다른 notify 함수와 달리 결과를 돌려준다. 스케줄러가 부르는 것이라 화면에
// 아무도 없고, 응답 말고는 "돌긴 돌았는지"를 알 방법이 없다.
export async function sendWeeklyDigest({ today = todayInKst() } = {}) {
  const result = { brands: 0, sent: 0, skipped: 0, failed: 0 };
  try {
    const supabase = getSupabaseAdmin();
    const { data: brands, error: brandError } = await supabase.from('brands').select('id, name');
    if (brandError) throw brandError;

    for (const brand of brands ?? []) {
      // 종결 건까지 전부 읽는다. '완료 N건'을 세려면 필요하고, 판정식들이
      // 각자 종결 여부를 보므로 여기서 미리 거르면 오히려 어긋난다.
      const { data: requirements, error: reqError } = await supabase
        .from('requirements')
        .select(
          'id, title, status, assignee, requester, request_date, expected_release_date, redmine_url, completed_at'
        )
        .eq('brand_id', brand.id);
      if (reqError) throw reqError;
      if ((requirements ?? []).length === 0) continue;

      const { data: roles, error: rolesError } = await supabase
        .from('user_brand_roles')
        .select('team_member_id, tier')
        .eq('brand_id', brand.id);
      if (rolesError) throw rolesError;

      // 접수 알림과 같은 범위(3차 이상). actorId 가 없으므로 전원이 후보다.
      const memberIds = submitRecipients(roles ?? [], null);
      if (memberIds.length === 0) continue;
      result.brands += 1;

      const emails = await loadEmails(supabase, memberIds);
      for (const memberId of memberIds) {
        const to = emails.get(memberId);
        if (!to) {
          result.skipped += 1;
          continue;
        }
        const digest = buildWeeklyDigest({ requirements, memberId, today });
        // 손볼 것이 없으면 이 사람에게는 안 보낸다. 같은 브랜드에서도 사람마다
        // 갈릴 수 있다 — 담당 지연만 있는 사람과 아무것도 없는 사람.
        if (!digest.hasContent) {
          result.skipped += 1;
          continue;
        }
        // 한 통씩 보낸다. sendMailToMany 는 같은 본문을 여럿에게 보내는
        // 함수라 개인화된 본문에는 못 쓴다.
        await runQuietly('주간 요약 메일', async () => {
          await sendMail({
            to,
            ...weeklyDigestEmail({
              brandName: brand.name,
              digest,
              summaryLine: digestSummaryLine(digest),
              baseUrl: appBaseUrl(),
            }),
          });
          result.sent += 1;
        });
      }
    }
  } catch (error) {
    result.failed += 1;
    logFailure('주간 요약', error);
  }
  return result;
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
export async function notifySignup({ name, organizationName }) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: admins, error } = await supabase
      .from('team_members')
      .select('id, email')
      .eq('is_global_admin', true)
      .eq('is_active', true);
    if (error) throw error;

    const message = signupMessage(name, organizationName);

    // 두 통로를 따로 돌린다. 인앱이 실패해도 메일은 나가야 한다 — 예전에는
    // 이 둘이 붙어 있어서 인앱 insert 하나가 메일까지 같이 죽였다.
    await runQuietly('가입 신청 인앱', () =>
      insertNotificationRows(
        supabase,
        (admins ?? []).map((admin) => ({
          team_member_id: admin.id,
          requirement_id: null,
          message,
          link: '/admin/members',
        }))
      )
    );

    // 배치 대기는 메일까지 보낸다. 가입한 사람은 배치될 때까지 로그인해도
    // 할 수 있는 일이 없어서, 관리자가 벨을 볼 때까지 그냥 기다린다.
    await runQuietly('가입 신청 메일', () =>
      sendMailToMany(
        (admins ?? []).map((admin) => admin.email),
        signupEmail({ name, organizationName, baseUrl: appBaseUrl() })
      )
    );
  } catch (error) {
    logFailure('가입 신청', error);
  }
}

// 메일 제목에 쓸 다음 목요일(YYYY-MM-DD).
//
// 수요일에 보내므로 대개 '내일'이다. 크론이 하루 밀려 목요일에 돌면 그날이
// 나온다 — 지난 목요일을 적어 두면 받는 사람이 지난주 메일로 착각한다.
function nextThursday(nowIso) {
  const date = new Date(nowIso);
  if (Number.isNaN(date.getTime())) return '';
  const THURSDAY = 4;
  date.setUTCDate(date.getUTCDate() + ((THURSDAY - date.getUTCDay() + 7) % 7));
  return date.toISOString().slice(0, 10);
}

// 회의 안건 메일. 수요일 오후에 한 번 불린다.
//
// sendWeeklyDigest 와 뼈대가 같지만 개인화가 없어서 브랜드당 한 번만 만들고
// 여럿에게 보낸다 — 그래서 sendMail 이 아니라 sendMailToMany 를 쓴다.
export async function sendMeetingDigest({ now = new Date().toISOString(), meetingDate } = {}) {
  const result = { brands: 0, sent: 0, skipped: 0, failed: 0 };
  try {
    const supabase = getSupabaseAdmin();
    // 비활성 브랜드는 건너뛴다. 지금 6개 중 4개가 비활성이고, 그쪽은 요구사항이
    // 없어서 어차피 hasContent 에서 걸리지만 조회를 줄인다.
    const { data: brands, error: brandError } = await supabase
      .from('brands')
      .select('id, name')
      .eq('is_active', true);
    if (brandError) throw brandError;

    for (const brand of brands ?? []) {
      // 종결 건까지 전부 읽는다. '이번 주 움직인 것'에 완료 건이 들어가야 하고,
      // 정체 판정이 각자 종결 여부를 보므로 여기서 거르면 어긋난다.
      const { data: requirements, error: reqError } = await supabase
        .from('requirements')
        .select('id, title, status, assignee, requester, created_at')
        .eq('brand_id', brand.id);
      if (reqError) throw reqError;
      if ((requirements ?? []).length === 0) continue;

      const ids = requirements.map((r) => r.id);
      const { data: changeLogs, error: logError } = await supabase
        .from('change_logs')
        .select('requirement_id, field_name, change_type, created_at')
        .in('requirement_id', ids);
      if (logError) throw logError;
      const { data: comments, error: commentError } = await supabase
        .from('requirement_comments')
        .select('requirement_id, created_at')
        .in('requirement_id', ids);
      if (commentError) throw commentError;

      const digest = buildMeetingDigest({
        requirements,
        changeLogs: changeLogs ?? [],
        comments: comments ?? [],
        now,
      });
      // 안건이 없으면 안 보낸다. 안건 없는 메일이 오기 시작하면 정작 밀린
      // 주에도 안 열린다.
      if (!digest.hasContent) {
        result.skipped += 1;
        continue;
      }

      const { data: roles, error: rolesError } = await supabase
        .from('user_brand_roles')
        .select('team_member_id, tier')
        .eq('brand_id', brand.id);
      if (rolesError) throw rolesError;

      // 접수 알림과 같은 범위(3차 이상). 회의 참석자가 곧 그 범위다.
      const memberIds = submitRecipients(roles ?? [], null);
      if (memberIds.length === 0) continue;

      const emails = await loadEmails(supabase, memberIds);
      const to = memberIds.map((id) => emails.get(id)).filter(Boolean);
      if (to.length === 0) {
        result.skipped += 1;
        continue;
      }
      result.brands += 1;

      await runQuietly('회의 안건 메일', async () => {
        await sendMailToMany({
          to,
          ...meetingDigestEmail({
            brandName: brand.name,
            meetingDate: meetingDate ?? nextThursday(now),
            digest,
            baseUrl: appBaseUrl(),
          }),
        });
        result.sent += to.length;
      });
    }
  } catch (error) {
    result.failed += 1;
    logFailure('회의 안건', error);
  }
  return result;
}

// 회의에서 배정된 것을 요청자에게 알린다.
//
// groups: lib/meetingSession.js 의 groupAssignmentsByRequester 결과.
//   [{ requesterId, items: [{ id, title, assigneeName, expectedDate }] }]
//
// 인앱도 함께 남긴다. 지금 95%가 안 읽히는 통로라 기대하지는 않지만, 메일
// 주소가 없는 사람에게는 그것뿐이다(loadEmails 가 조용히 걸러 낸다).
export async function notifyMeetingAssignments(groups) {
  const result = { sent: 0, skipped: 0 };
  if (!groups || groups.length === 0) return result;
  try {
    const supabase = getSupabaseAdmin();
    const emails = await loadEmails(
      supabase,
      groups.map((g) => g.requesterId)
    );
    for (const group of groups) {
      const message = `회의에서 올리신 요구사항 ${group.items.length}건에 담당자가 정해졌습니다.`;
      // 벨은 건마다 하나다. 눌러서 갈 곳이 건별 상세라 묶을 수가 없다 —
      // 묶은 알림 하나는 어느 건으로 가야 할지 정할 수 없다.
      await runQuietly('회의 배정 인앱', () =>
        insertNotificationRows(
          supabase,
          group.items.map((item) => ({
            team_member_id: group.requesterId,
            requirement_id: item.id,
            message,
          }))
        )
      );

      const to = emails.get(group.requesterId);
      if (!to) {
        result.skipped += 1;
        continue;
      }
      await runQuietly('회의 배정 메일', async () => {
        await sendMail({
          to,
          ...assignedBatchEmail({ items: group.items, baseUrl: appBaseUrl() }),
        });
        result.sent += 1;
      });
    }
  } catch (error) {
    logFailure('회의 배정', error);
  }
  return result;
}

// 새 의견 — 전체 관리자에게 메일만.
//
// notifySignup 과 짝이지만 인앱을 안 보낸다. 배치대기는 벨을 본 관리자가 바로
// 처리할 수 있는 일이지만, 의견은 읽고 판단하는 일이라 벨 한 줄에 담기지
// 않는다. 그리고 지금 벨은 110건 중 105건이 안 읽혔다.
//
// 수신자는 DB 의 is_global_admin 으로만 정해진다. 부르는 라우트가 넘긴 값 중
// 어느 것도 권한이 되지 않는다.
export async function notifyFeedback({ name, message }) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: admins, error } = await supabase
      .from('team_members')
      .select('email')
      .eq('is_global_admin', true)
      .eq('is_active', true);
    if (error) throw error;

    await runQuietly('의견 메일', () =>
      sendMailToMany(
        (admins ?? []).map((admin) => admin.email),
        feedbackEmail({ name, message, baseUrl: appBaseUrl() })
      )
    );
  } catch (error) {
    logFailure('의견', error);
  }
}

// 의견을 반영했다고 낸 사람에게 알린다 — 인앱.
//
// 여기는 벨이 맞는 자리다. "당신이 낸 것에 답이 왔다"이고, 받는 사람이
// 한 명이며, 그 사람은 자기가 뭘 냈는지 안다.
//
// 메일로는 안 보낸다. EMAIL_EVENTS 는 "지금 당신이 뭘 해야 하는" 것만 싣는데
// 이건 할 일이 아니라 소식이다.
export async function notifyFeedbackResolved({ memberId, note }) {
  try {
    if (!memberId) return;
    const supabase = getSupabaseAdmin();
    const trimmed = typeof note === 'string' ? note.trim() : '';
    await runQuietly('의견 반영 인앱', () =>
      insertNotificationRows(supabase, [
        {
          team_member_id: memberId,
          requirement_id: null,
          message: trimmed
            ? `의견 주신 것 반영했습니다 — ${trimmed}`
            : '의견 주신 것 반영했습니다',
          link: null,
        },
      ])
    );
  } catch (error) {
    logFailure('의견 반영', error);
  }
}

// 요건 확인 질문 — 요청자에게.
//
// 이 앱에서 요청자에게 메일이 가는 두 번째 자리다(첫째는 회의배정). 요청자가
// 실제로 무언가 해야 하는 순간이 정확히 여기다 — 답을 안 주면 그 건은 멈춘다.
//
// 벨도 함께 보낸다. 메일을 못 받는 계정(주소 없음)이 있어서, 인앱이 최소한의
// 바닥이 된다.
export async function notifyAsk({ requirementId, actorId, question }) {
  try {
    const context = await loadContext(requirementId, [actorId]);
    if (!context) return;
    const { supabase, requirement, names } = context;
    const requesterId = requirement.requester;
    // 자기가 올린 건에 자기가 물을 일은 없지만, 그 경우 자기 자신에게 메일이
    // 가는 것은 소음이다.
    if (!requesterId || requesterId === actorId) return;

    const who = names.get(actorId);
    const short = typeof question === 'string' ? question.trim() : '';

    await runQuietly('요건 확인 인앱', () =>
      insertNotificationRows(supabase, [
        {
          team_member_id: requesterId,
          requirement_id: requirementId,
          message: `${who ? `${who}님이` : '누군가'} '${requirement.title}' 요건을 확인하고 싶어 합니다 — ${short}`,
          link: `/requirements/${requirementId}`,
        },
      ])
    );

    await runQuietly('요건 확인 메일', async () => {
      const emails = await loadEmails(supabase, [requesterId]);
      await sendMailToMany(
        [...emails.values()],
        askEmail({
          title: requirement.title,
          actorName: who,
          question: short,
          requirementId,
          baseUrl: appBaseUrl(),
        })
      );
    });
  } catch (error) {
    logFailure('요건 확인', error);
  }
}

// 답이 왔다 — 물어본 사람에게 인앱만.
//
// 메일을 안 보낸다. EMAIL_EVENTS 는 "지금 당신이 뭘 해야 하는" 것만 싣는데,
// 답이 온 것은 다음 회의에서 볼 일이다. 그리고 그 건은 회의 안건에 저절로
// 다시 올라온다 — 그쪽이 진짜 통로다.
export async function notifyAnswered({ requirementId, askedBy, answeredBy }) {
  try {
    if (!askedBy || askedBy === answeredBy) return;
    const context = await loadContext(requirementId, [answeredBy]);
    if (!context) return;
    const { supabase, requirement, names } = context;
    const who = names.get(answeredBy);
    await runQuietly('요건 확인 답변 인앱', () =>
      insertNotificationRows(supabase, [
        {
          team_member_id: askedBy,
          requirement_id: requirementId,
          message: `${who ? `${who}님이` : '요청자가'} '${requirement.title}' 확인 요청에 답했습니다`,
          link: `/requirements/${requirementId}`,
        },
      ])
    );
  } catch (error) {
    logFailure('요건 확인 답변', error);
  }
}
