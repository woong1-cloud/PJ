import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';

// 결정 대기 — RAID 로그의 D. 00_개요 의 [먼저 결정할 것] 14건과, 회의 중에
// 계속 생기는 손으로 더한 것들.
//
// 결정이 안 나면 뒤따르는 항목이 못 움직인다. lib/launchDecisions.js 의
// parseDecisions 가 시트를 읽고, 여기가 그것을 저장·조회한다.

const PENDING_STATUS = '대기';

// 결정 하나에 그것을 기다리는 막힌 항목이 몇 건인지 붙인다.
//
// "이걸 기다리던 3건" 을 보여주려면 화면이 매번 launch_tasks 를 따로
// 뒤지게 만들 수 없다 — 결정 목록을 부를 때 같이 준다.
async function withWaitingCount(supabase, launchId, decisions) {
  if (decisions.length === 0) return [];

  const { data: blocked, error } = await supabase
    .from('launch_tasks')
    .select('blocked_decision_id')
    .eq('launch_id', launchId)
    .not('blocked_decision_id', 'is', null);
  if (error) throw error;

  const counts = new Map();
  for (const t of blocked ?? []) {
    counts.set(t.blocked_decision_id, (counts.get(t.blocked_decision_id) ?? 0) + 1);
  }
  return decisions.map((d) => ({ ...d, waitingCount: counts.get(d.id) ?? 0 }));
}

export async function GET(request, { params }) {
  try {
    await requireGlobalAdmin();
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: decisions, error } = await supabase
      .from('launch_decisions')
      .select('*')
      .eq('launch_id', id)
      .order('seq', { ascending: true });
    if (error) throw error;

    const result = await withWaitingCount(supabase, id, decisions ?? []);
    return Response.json({ decisions: result });
  } catch (error) {
    return errorResponse(error);
  }
}

function trimmedOrNull(value) {
  const t = String(value ?? '').trim();
  return t || null;
}

// 시트에서 가져오기. seq 로 upsert 하되, 이미 결정된 것(대기 아님)은
// 안 건드린다 — 재가져오기가 회의 결과를 지우면 안 된다. lib/launchReimport.js
// 의 '손으로 고친 줄은 독립한다' 와 같은 규칙이다.
async function importFromSheet(supabase, launchId, incoming) {
  const { data: existing, error: exErr } = await supabase
    .from('launch_decisions')
    .select('id, seq, status')
    .eq('launch_id', launchId);
  if (exErr) throw exErr;
  const bySeq = new Map((existing ?? []).map((d) => [d.seq, d]));

  const created = [];
  const updated = [];
  const skipped = [];

  for (const item of incoming) {
    const seq = Number(item?.seq);
    const title = trimmedOrNull(item?.title);
    // seq 가 없거나 결정 항목이 비면 이 줄은 버린다 — parseDecisions 가
    // 이미 걸러 보내지만, 손으로 만든 요청도 같은 문 앞에 세운다.
    if (!Number.isFinite(seq) || !title) continue;

    const patch = {
      when_text: trimmedOrNull(item?.when_text),
      title,
      impact: trimmedOrNull(item?.impact),
      owner_text: trimmedOrNull(item?.owner_text),
    };

    const cur = bySeq.get(seq);
    if (!cur) {
      const { data, error } = await supabase
        .from('launch_decisions')
        .insert({ launch_id: launchId, seq, ...patch })
        .select('*')
        .single();
      if (error) throw error;
      created.push(data);
      continue;
    }

    if (cur.status !== PENDING_STATUS) {
      // 이미 결정됐거나 보류됐다. 시트가 그 판단을 덮으면 안 된다.
      skipped.push({ id: cur.id, seq, status: cur.status });
      continue;
    }

    const { data, error } = await supabase
      .from('launch_decisions')
      .update(patch)
      .eq('id', cur.id)
      .select('*')
      .single();
    if (error) throw error;
    updated.push(data);
  }

  return { created, updated, skipped };
}

// 손으로 하나 추가. 시트의 14건이 전부일 리 없다 — 회의 중에 막히면서
// 계속 생긴다. 이쪽이 실제로 더 많이 쓰일 길이다.
async function addManual(supabase, launchId, body) {
  const title = String(body?.title ?? '').trim();
  if (!title) throw new ApiError(400, '결정 항목을 입력하세요.');

  const { data: rows, error: seqErr } = await supabase
    .from('launch_decisions')
    .select('seq')
    .eq('launch_id', launchId)
    .order('seq', { ascending: false })
    .limit(1);
  if (seqErr) throw seqErr;
  const seq = (rows?.[0]?.seq ?? 0) + 1;

  const { data, error } = await supabase
    .from('launch_decisions')
    .insert({
      launch_id: launchId,
      seq,
      title,
      when_text: trimmedOrNull(body?.when_text),
      impact: trimmedOrNull(body?.impact),
      owner_text: trimmedOrNull(body?.owner_text),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function POST(request, { params }) {
  try {
    await requireGlobalAdmin();
    const { id } = await params;
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    if (Array.isArray(body?.decisions)) {
      const result = await importFromSheet(supabase, id, body.decisions);
      return Response.json(result, { status: 200 });
    }

    const decision = await addManual(supabase, id, body);
    return Response.json({ decision }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
