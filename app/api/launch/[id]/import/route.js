import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { planReimport, IMPORT_EXCLUDED_REASON } from '@/lib/launchReimport';
import { NA_STATUS, TODO_STATUS } from '@/lib/launchTask';

const MAX_ITEMS = 2000;
// lib/launchImport.js 의 CODE 와 같아야 한다. 여기가 좁으면 화면이 읽은
// 것이 서버에서 조용히 사라진다.
const CODE = /^\d{2}[A-Z]?-\d{2}$/;

// 런칭에 엑셀을 직접 가져온다.
//
// 1단계에는 길이 하나뿐이었다 — 엑셀 → 가이드 → 복제 → 런칭. 항목은 값
// 복사라 가이드를 고쳐도 진행 중인 런칭에 안 닿는다. 그 원칙은 맞지만,
// 기준 파일은 가이드가 아니라 그 런칭 자체다. 길을 하나 더 낸다.
//
// 준비 상태에서만 열린다. 진행 중으로 넘어가면 엑셀 문이 닫히고 그 뒤로는
// 모아에서만 관리한다 — 이 프로젝트의 목적이 그것이다.
//
// 규칙 하나: 계획은 엑셀이 원본, 진행은 모아가 원본. planReimport 가
// 계획 열(제목·워크스트림·D-day 등)만 덮고 진행 열(상태·담당·막힌 이유)은
// 안 건드리는 이유가 그것이다 — 자세한 판단은 lib/launchReimport.js 에 있다.
export async function POST(request, { params }) {
  try {
    const { memberId } = await requireGlobalAdmin();
    const { id } = await params;
    const { items, context, sourceVersion } = await request.json();

    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, '가져올 항목이 없습니다.');
    }
    if (items.length > MAX_ITEMS) throw new ApiError(400, '한 번에 처리할 수 있는 양을 넘었습니다.');

    const supabase = getSupabaseAdmin();
    const { data: launch, error: lErr } = await supabase
      .from('launches')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();
    if (lErr) throw lErr;
    if (!launch) throw new ApiError(404, '런칭을 찾을 수 없습니다.');
    if (launch.status !== '준비') {
      throw new ApiError(
        400,
        '진행 중인 런칭은 엑셀로 덮어쓸 수 없습니다. 준비로 되돌린 뒤 다시 시도하세요.',
      );
    }

    // 화면이 보낸 것을 믿지 않는다. 아는 열만 골라 담는다.
    const clean = [];
    for (const raw of items) {
      const code = String(raw?.code ?? '').trim();
      const title = String(raw?.title ?? '').trim();
      const workstream = String(raw?.workstream ?? '').trim();
      const dayOffset = Number(raw?.day_offset);
      if (!CODE.test(code) || !title || !workstream) continue;
      if (!Number.isFinite(dayOffset)) continue;

      const na = raw?.not_applicable === true;
      clean.push({
        code,
        workstream,
        title,
        category: raw?.category ?? null,
        channel: raw?.channel ?? null,
        decision_org: raw?.decision_org ?? null,
        owner_org: raw?.owner_org ?? null,
        owner_role: raw?.owner_role ?? null,
        support_role: raw?.support_role ?? null,
        depends_on: Array.isArray(raw?.depends_on)
          ? raw.depends_on.filter((c) => CODE.test(String(c)))
          : [],
        day_offset: Math.trunc(dayOffset),
        deliverable: raw?.deliverable ?? null,
        note: raw?.note ?? null,
        plain_text: raw?.plain_text ?? null,
        is_critical: raw?.is_critical === true,
        sort_order: Number.isFinite(Number(raw?.sort_order)) ? Number(raw.sort_order) : 0,
        // not_applicable 은 여기서만 쓰고 아래로 안 넘긴다 — planReimport 가
        // create[] 를 계획 열(PLAN_COLUMNS)만으로 만들어서 이 키는 원래도
        // 안 새지만, 의도를 분명히 하려고 남긴다.
        not_applicable: na,
        // 사유 없는 해당없음은 만들지 않는다.
        excluded_reason: na
          ? String(raw?.excluded_reason ?? '').trim() || '양식에서 제외 표시됨'
          : null,
      });
    }
    if (clean.length === 0) throw new ApiError(400, '읽을 수 있는 항목이 없습니다.');

    // 계획 열도 가져와야 한다 — planReimport 가 실제로 바뀐 열만 골라내려면
    // 시트 값과 견줄 지금 값이 있어야 한다(lib/launchReimport.js 의 same()).
    const { data: existing, error: exErr } = await supabase
      .from('launch_tasks')
      .select(
        'id, code, status, source, excluded_reason, title, workstream, category, channel, decision_org, owner_org, owner_role, support_role, depends_on, day_offset, deliverable, note, plain_text, is_critical, sort_order',
      )
      .eq('launch_id', id);
    if (exErr) throw exErr;

    const plan = planReimport({ incoming: clean, existing: existing ?? [] });
    const now = new Date().toISOString();

    // plan.create[] 는 계획 열(PLAN_COLUMNS) + code·source·status·
    // excluded_reason 만 갖는다(lib/launchReimport.js 의 planPatch). raw 의
    // not_applicable 같은 DB 에 없는 키는 여기 안 섞인다 — insert 가
    // 통째로 실패할 위험이 없다.
    if (plan.create.length > 0) {
      const rows = plan.create.map((c) => ({
        ...c,
        launch_id: id,
        excluded_at: c.status === NA_STATUS ? now : null,
        excluded_by: c.status === NA_STATUS ? memberId : null,
      }));
      const { error } = await supabase.from('launch_tasks').insert(rows);
      if (error) throw error;
    }

    // 계획 열만 덮는다. 상태·담당·막힌 이유·완료 시각은 patch 에 없다
    // (lib/launchReimport.js 의 PLAN_COLUMNS).
    for (const u of plan.update) {
      const { error } = await supabase
        .from('launch_tasks')
        .update({ ...u.patch, updated_at: now })
        .eq('id', u.id);
      if (error) throw error;
    }

    for (const e of plan.exclude) {
      const { error } = await supabase
        .from('launch_tasks')
        .update({
          status: NA_STATUS,
          // 뺄 때의 상태를 사유에 붙여 남긴다. 되살릴 때 '하는 중이었는데'
          // 가 사라지지 않게 하는 유일한 자리다. planReimport 가 이 문자열을
          // startsWith 로 알아보고 직전 상태를 뽑아낸다.
          excluded_reason: `${IMPORT_EXCLUDED_REASON} (직전 상태: ${e.previous_status})`,
          excluded_at: now,
          excluded_by: memberId,
          updated_at: now,
        })
        .eq('id', e.id);
      if (error) throw error;
    }

    // 양식이 "이건 안 함"이라고 표시한 것. 이미 있는 항목이라 계획 열만
    // 덮으면 그 표시가 통째로 무시된다 — 브랜드가 양식을 채우는 흐름이
    // 바로 이것이라, 여기가 빠지면 양식을 만든 의미가 없다.
    //
    // 사유는 양식의 비고에서 온다. 사람이 쓴 문장이라 '양식에서 빠짐' 과
    // 구분되고, 그래서 다음 가져오기가 되살리지 않는다.
    for (const m of plan.markNa) {
      const { error } = await supabase
        .from('launch_tasks')
        .update({
          status: NA_STATUS,
          excluded_reason: m.excluded_reason || '양식에서 제외 표시됨',
          excluded_at: now,
          excluded_by: memberId,
          updated_at: now,
        })
        .eq('id', m.id);
      if (error) throw error;
    }

    for (const r of plan.restore) {
      const { error } = await supabase
        .from('launch_tasks')
        .update({
          // 뺄 때의 상태로 돌아간다. '할 것' 으로만 돌리면 "하는 중이었는데"
          // 가 사라진다.
          status: r.status ?? TODO_STATUS,
          excluded_reason: null,
          excluded_at: null,
          excluded_by: null,
          updated_at: now,
        })
        .eq('id', r.id);
      if (error) throw error;
    }

    // 전제 7줄. 항목과 함께 온다.
    const patch = { updated_at: now };
    if (Array.isArray(context) && context.length > 0) {
      patch.context = context
        .filter((c) => String(c?.label ?? '').trim() && String(c?.value ?? '').trim())
        .slice(0, 40)
        .map((c) => ({ label: String(c.label).trim(), value: String(c.value).trim() }));
    }
    if (sourceVersion) patch.note = String(sourceVersion).slice(0, 200);
    await supabase.from('launches').update(patch).eq('id', id);

    return Response.json({
      ok: true,
      created: plan.create.length,
      // 실제로 값이 다른 것만이다. 안 바뀐 것은 unchanged 로 따로 센다 —
      // "갱신 476건"은 사람에게 아무 말도 안 한다.
      updated: plan.update.map((u) => ({ code: u.code, title: u.title, changes: u.changes })),
      unchanged: plan.unchanged.length,
      excluded: plan.exclude,
      markedNa: plan.markNa.length,
      restored: plan.restore.length,
      // 양식은 해당없음이라는데 사람이 이미 붙어 있는 것. 자동으로 안 바꾸고
      // 알리기만 한다 — 양식이 늦게 반영된 것일 수 있고, 진행 중인 일을
      // 파일이 지우면 안 된다. 사람이 보고 정한다.
      busy: plan.busy,
      untouched: plan.untouched,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
