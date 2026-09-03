import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { LAUNCH_KINDS } from '@/lib/launchKind';

// 한 런칭이 가질 수 있는 항목 수. v10 이 403건이라 넉넉히 잡는다.
const MAX_TASKS = 2000;

// 브랜드 런칭 — 목록과 만들기.
//
// beta 동안은 전체 관리자만이다. 참여자 개념(launch_members)은 테이블에
// 있지만 화면이 아직 없다 — 실제로 여러 부서가 들어오는 것은 메일이 붙는
// 3단계부터이고, 그 전에 계정을 열면 아무 일도 안 하는 사람만 늘어난다.

const LAUNCH_SELECT =
  'id, name, open_date, kind, status, note, guide_id, brand_id, created_at, updated_at';

export async function GET() {
  try {
    await requireGlobalAdmin();
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('launches')
      // 오픈이 가까운 것이 위. 끝난 런칭은 아래로 밀리지만 목록에 남는다 —
      // 가이드의 실적이 어디서 왔는지가 이 목록이다.
      .select(LAUNCH_SELECT)
      .order('open_date', { ascending: true });
    if (error) throw error;

    // 진척은 여기서 센다. 런칭마다 항목 수를 저장해 두면 항목을 더하거나
    // 뺄 때 그 숫자가 갈린다.
    const launches = [];
    for (const launch of data ?? []) {
      const [total, done] = await Promise.all([
        supabase
          .from('launch_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('launch_id', launch.id),
        supabase
          .from('launch_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('launch_id', launch.id)
          .eq('status', '완료'),
      ]);
      launches.push({
        ...launch,
        taskCount: total.count ?? 0,
        doneCount: done.count ?? 0,
      });
    }

    return Response.json({ launches });
  } catch (error) {
    return errorResponse(error);
  }
}

// 런칭을 만든다 — 가이드에서 항목을 복제한다.
//
// 참조가 아니라 값 복사다. 참조로 두면 D-30 에 누가 가이드를 고쳤을 때
// 진행 중인 런칭이 슬쩍 바뀌고, 그 순간 아무도 화면을 못 믿는다.
// guide_item_id 는 남긴다 — 런칭이 끝나면 계획 vs 실제가 그 연결로 쌓인다.
export async function POST(request) {
  try {
    const { memberId } = await requireGlobalAdmin();
    const { name, openDate, kind, guideId, workstreams, brandId } = await request.json();

    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) throw new ApiError(400, '브랜드명을 입력하세요.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(openDate ?? ''))) {
      throw new ApiError(400, '오픈일을 골라 주세요.');
    }
    if (kind && !LAUNCH_KINDS.includes(kind)) throw new ApiError(400, '알 수 없는 유형입니다.');
    if (!guideId) throw new ApiError(400, '가이드가 필요합니다.');
    const picked = Array.isArray(workstreams) ? workstreams.filter(Boolean) : [];
    if (picked.length === 0) throw new ApiError(400, '가져올 워크스트림을 하나 이상 고르세요.');

    const supabase = getSupabaseAdmin();

    // .in() 에 빈 배열을 넘기면 PostgREST 가 400 을 낸다. 위에서 이미
    // 막았지만, 이 조회가 실패하면 빈 런칭이 만들어진다.
    const { data: items, error: itemError } = await supabase
      .from('launch_guide_items')
      .select('*')
      .eq('guide_id', guideId)
      .in('workstream', picked)
      .order('workstream', { ascending: true })
      .order('sort_order', { ascending: true });
    if (itemError) throw itemError;
    if ((items ?? []).length === 0) {
      throw new ApiError(400, '고른 워크스트림에 항목이 없습니다.');
    }
    if (items.length > MAX_TASKS) throw new ApiError(400, '항목이 너무 많습니다.');

    const { data: launch, error: launchError } = await supabase
      .from('launches')
      .insert({
        name: trimmed,
        open_date: openDate,
        kind: kind ?? null,
        guide_id: guideId,
        brand_id: brandId || null,
        created_by: memberId,
      })
      .select(LAUNCH_SELECT)
      .single();
    if (launchError) throw launchError;

    const tasks = items.map((item, index) => ({
      launch_id: launch.id,
      guide_item_id: item.id,
      code: item.code,
      workstream: item.workstream,
      category: item.category,
      title: item.title,
      channel: item.channel,
      decision_org: item.decision_org,
      owner_org: item.owner_org,
      owner_role: item.owner_role,
      support_role: item.support_role,
      // 선행조건은 안 가져온 워크스트림을 가리킬 수 있다. 그대로 둔다 —
      // isWaitingOnDep 이 목록에 없는 코드를 대기로 안 치므로(lib/launchTask.js)
      // 여기서 걸러내면 나중에 그 워크스트림을 더할 때 연결이 사라진다.
      depends_on: item.depends_on ?? [],
      day_offset: item.day_offset,
      deliverable: item.deliverable,
      note: item.note,
      is_critical: item.is_critical,
      sort_order: index,
    }));

    const { error: taskError } = await supabase.from('launch_tasks').insert(tasks);
    if (taskError) {
      // 항목이 안 들어갔으면 빈 런칭이 남는다. 그걸 지우고 실패로 돌린다 —
      // 목록에 0건짜리 런칭이 남으면 사람이 왜 그런지 알 수 없다.
      await supabase.from('launches').delete().eq('id', launch.id);
      throw taskError;
    }

    return Response.json({ launch, taskCount: tasks.length }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
