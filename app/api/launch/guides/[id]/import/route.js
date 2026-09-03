import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { planImport } from '@/lib/launchImport';

// 한 번에 받을 수 있는 양. 통합 WBS 가 476건이라 넉넉히 잡는다.
const MAX_ITEMS = 2000;
const MAX_ROLES = 100;

// 항목 코드. lib/launchImport.js 의 CODE 와 같아야 한다. 서버가 화면을 안
// 믿고 다시 거르는 자리라, 여기가 좁으면 화면이 읽은 것이 서버에서 사라진다.
const CODE = /^\d{2}[A-Z]?-\d{2}$/;

// 가이드에 항목을 가져온다.
//
// 화면이 파싱해 JSON 으로 보낸다(파일을 서버에 안 올린다). 서버는 받은 것을
// 다시 검증한다 — 화면이 보낸 것을 믿지 않는다.
//
// 여러 번 올려도 안전하다. code 로 맞춰 upsert 하므로 v11 이 나오면 그대로
// 올리면 된다. 가이드 항목에는 상태가 없어서 덮을 진행 상태도 없다 —
// 진행 상태는 런칭 항목이 갖는다(스펙 7절).
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    await requireGlobalAdmin();
    const { items, roles, sourceVersion } = await request.json();

    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, '가져올 항목이 없습니다.');
    }
    if (items.length > MAX_ITEMS) throw new ApiError(400, '한 번에 처리할 수 있는 양을 넘었습니다.');

    const supabase = getSupabaseAdmin();
    const { data: guide, error: guideError } = await supabase
      .from('launch_guides')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (guideError) throw guideError;
    if (!guide) throw new ApiError(404, '가이드를 찾을 수 없습니다.');

    // 화면이 보낸 것을 그대로 넣지 않는다. 아는 열만 골라 담는다 — 그래야
    // 엉뚱한 컬럼이 섞여 들어와 insert 가 통째로 실패하는 일이 없다.
    const clean = [];
    for (const raw of items) {
      const code = String(raw?.code ?? '').trim();
      const title = String(raw?.title ?? '').trim();
      const workstream = String(raw?.workstream ?? '').trim();
      const dayOffset = Number(raw?.day_offset);
      // 코드·제목·워크스트림·D-day 가 없으면 항목이 아니다. 화면의 파서가
      // 이미 걸렀지만 여기가 관문이다.
      if (!CODE.test(code) || !title || !workstream) continue;
      if (!Number.isFinite(dayOffset)) continue;

      clean.push({
        guide_id: id,
        code,
        workstream,
        category: raw?.category ?? null,
        title,
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
        is_critical: raw?.is_critical === true,
        sort_order: Number.isFinite(Number(raw?.sort_order)) ? Number(raw.sort_order) : 0,
      });
    }
    if (clean.length === 0) throw new ApiError(400, '읽을 수 있는 항목이 없습니다.');

    const { data: existing, error: exError } = await supabase
      .from('launch_guide_items')
      .select('code')
      .eq('guide_id', id);
    if (exError) throw exError;

    const plan = planImport({ incoming: clean, existing: existing ?? [] });

    // unique (guide_id, code) 위에서 upsert 한다. 마이그레이션의 그 제약이
    // 이 한 줄을 안전하게 만든다.
    const { error: upError } = await supabase
      .from('launch_guide_items')
      .upsert(clean, { onConflict: 'guide_id,code' });
    if (upError) throw upError;

    // 역할 사전. 없으면 건너뛴다 — 24_R&R분배 가 없는 시트도 있을 수 있다.
    let roleCount = 0;
    if (Array.isArray(roles) && roles.length > 0 && roles.length <= MAX_ROLES) {
      const cleanRoles = roles
        .filter((r) => String(r?.name ?? '').trim())
        .map((r, i) => ({
          guide_id: id,
          name: String(r.name).trim(),
          org: r?.org ?? null,
          scope_text: r?.scope_text ?? null,
          sort_order: Number.isFinite(Number(r?.sort_order)) ? Number(r.sort_order) : i,
        }));
      if (cleanRoles.length > 0) {
        const { error: roleError } = await supabase
          .from('launch_roles')
          .upsert(cleanRoles, { onConflict: 'guide_id,name' });
        if (roleError) throw roleError;
        roleCount = cleanRoles.length;
      }
    }

    // 어디서 온 파일인지 남긴다. 다시 가져올 때 사람이 확인할 근거다.
    if (sourceVersion) {
      await supabase
        .from('launch_guides')
        .update({ source_version: String(sourceVersion).slice(0, 200), updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    return Response.json({
      ok: true,
      created: plan.create.length,
      updated: plan.update.length,
      // 시트에서 빠진 것은 지우지 않는다. 사람이 한 줄을 지웠다고 해서 이미
      // 복제된 런칭 항목까지 사라지면 안 된다 — 지우는 것은 손으로 한다.
      missing: plan.missing,
      roles: roleCount,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
