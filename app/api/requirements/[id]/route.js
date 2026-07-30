import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireBrandAccess, requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { TIER_RANK } from '@/lib/tiers';
import { DONE_STATUS, MERGED_STATUS } from '@/lib/statuses';
import { CHANNELS, DEFAULT_CHANNEL } from '@/lib/channels';
import { toSignedImageList, IMAGE_BUCKET } from '@/lib/storage';
import { computeStatusDurations } from '@/lib/statusDurations';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const supabase = getSupabaseAdmin();
    const { data: requirement, error: reqError } = await supabase
      .from('requirements')
      .select(
        '*, project:projects(id, name), ' +
          'requester:team_members!requirements_requester_fkey(id, name), ' +
          'assignee:team_members!requirements_assignee_fkey(id, name), ' +
          'category:brand_categories(id, category_name)'
      )
      .eq('id', id)
      .maybeSingle();
    if (reqError) throw reqError;
    if (!requirement) throw new ApiError(404, '요구사항을 찾을 수 없습니다.');

    const { tier, isGlobalAdmin } = await requireBrandAccess(requirement.brand_id, '4차');
    const canSeeConfidential = isGlobalAdmin || TIER_RANK[tier] >= TIER_RANK['3차'];
    if (requirement.is_confidential && !canSeeConfidential) {
      throw new ApiError(403, '비공개 요구사항은 조회할 수 없습니다.');
    }

    const { data: history, error: histError } = await supabase
      .from('change_logs')
      .select('id, changed_by, change_type, field_name, old_value, new_value, comment, created_at, ' +
        'changer:team_members!change_logs_changed_by_fkey(id, name)')
      .eq('requirement_id', id)
      .order('created_at', { ascending: true });
    if (histError) throw histError;

    const { data: duplicates, error: dupError } = await supabase
      .from('duplicate_links')
      .select('id, linked_note, requester:team_members!duplicate_links_linked_requester_fkey(id, name)')
      .eq('requirement_id', id)
      .order('created_at', { ascending: true });
    if (dupError) throw dupError;

    let mergedInto = null;
    if (requirement.status === MERGED_STATUS) {
      const { data: link, error: linkError } = await supabase
        .from('duplicate_links')
        .select('target:requirements!duplicate_links_requirement_id_fkey(id, title)')
        .like('linked_note', `% (#${id})`)
        .limit(1)
        .maybeSingle();
      if (linkError) throw linkError;
      if (link?.target) mergedInto = { id: link.target.id, title: link.target.title };
    }

    const { data: imageRows, error: imgError } = await supabase
      .from('requirement_images')
      .select('id, storage_path, content_type, sort_order')
      .eq('requirement_id', id)
      .order('sort_order', { ascending: true });
    if (imgError) throw imgError;
    const images = await toSignedImageList(imageRows);

    // 코멘트 본문은 ActivityFeed 가 자기 엔드포인트에서 따로 불러온다. 여기서는
    // 개수만 있으면 된다 — 영구 삭제 확인 화면에서 "코멘트 N건이 함께 사라진다"를
    // 정확히 말하기 위해서다. head:true 라 본문은 안 가져온다.
    const { count: commentCount } = await supabase
      .from('requirement_comments')
      .select('id', { count: 'exact', head: true })
      .eq('requirement_id', id);

    // history 는 이미 이 요구사항의 change_logs 전체다 — 새 쿼리 없이 여기서
    // 상태 구간만 걸러 계산한다. field_name 으로 거른다, change_type 이 아니라 —
    // 상태 변경은 '상태변경'과 '중복병합' 두 change_type 을 쓴다.
    const statusDurations = computeStatusDurations({
      createdAt: requirement.created_at,
      currentStatus: requirement.status,
      changeLogs: (history ?? []).filter((h) => h.field_name === 'status'),
      nowIso: new Date().toISOString(),
    });

    return Response.json({
      requirement,
      history,
      duplicates,
      mergedInto,
      images,
      statusDurations,
      commentCount: commentCount ?? 0,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { brandId, title, priority, urgency, category, asIs, toBe, note, isConfidential, channel } =
      body;
    if (!brandId) throw new ApiError(400, 'brandId가 필요합니다.');
    if (channel && !CHANNELS.includes(channel)) {
      throw new ApiError(400, '유효하지 않은 채널입니다.');
    }

    const { memberId, tier, isGlobalAdmin } = await requireBrandAccess(brandId, '4차');

    const supabase = getSupabaseAdmin();
    const { data: current, error: curError } = await supabase
      .from('requirements')
      .select('id, brand_id, status, requester')
      .eq('id', id)
      .maybeSingle();
    if (curError) throw curError;
    if (!current) throw new ApiError(404, '요구사항을 찾을 수 없습니다.');
    if (current.brand_id !== brandId) throw new ApiError(403, '브랜드가 일치하지 않습니다.');
    if (current.status === DONE_STATUS || current.status === MERGED_STATUS) {
      throw new ApiError(400, '완료되었거나 병합된 요구사항은 수정할 수 없습니다.');
    }

    const canProcess = isGlobalAdmin || TIER_RANK[tier] >= TIER_RANK['3차'];
    const isOwner = current.requester === memberId;
    if (!canProcess && !isOwner) {
      throw new ApiError(403, '수정 권한이 없습니다.');
    }

    const FIELD_LABELS = {
      title: '제목',
      priority: '우선순위',
      urgency: '긴급도',
      category: '카테고리',
      channel: '채널',
      asIs: 'As-Is',
      toBe: 'To-Be',
      note: '비고',
      isConfidential: '비공개여부',
    };
    const updates = {};
    const changedFields = [];
    if (title !== undefined) {
      if (!title.trim()) throw new ApiError(400, '제목은 필수입니다.');
      updates.title = title.trim();
      changedFields.push(FIELD_LABELS.title);
    }
    if (priority !== undefined) {
      updates.priority = priority || null;
      changedFields.push(FIELD_LABELS.priority);
    }
    if (urgency !== undefined) {
      updates.urgency = urgency || null;
      changedFields.push(FIELD_LABELS.urgency);
    }
    if (category !== undefined) {
      updates.category = category || null;
      changedFields.push(FIELD_LABELS.category);
    }
    // 채널은 비워둘 수 없다 — 빈 값이 섞이면 채널별 집계에서 그만큼이 샌다.
    if (channel !== undefined) {
      updates.channel = channel || DEFAULT_CHANNEL;
      changedFields.push(FIELD_LABELS.channel);
    }
    if (asIs !== undefined) {
      updates.as_is = asIs || null;
      changedFields.push(FIELD_LABELS.asIs);
    }
    if (toBe !== undefined) {
      updates.to_be = toBe || null;
      changedFields.push(FIELD_LABELS.toBe);
    }
    if (note !== undefined) {
      updates.note = note || null;
      changedFields.push(FIELD_LABELS.note);
    }
    if (isConfidential !== undefined && canProcess) {
      updates.is_confidential = Boolean(isConfidential);
      changedFields.push(FIELD_LABELS.isConfidential);
    }

    if (Object.keys(updates).length === 0) throw new ApiError(400, '수정할 필드가 없습니다.');

    updates.updated_at = new Date().toISOString();
    let { data, error: updError } = await supabase
      .from('requirements')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    // 42703 = undefined_column. 0009 미적용 DB에서는 채널만 빼고 나머지
    // 수정은 되게 한다 — 새 필드 하나 때문에 수정 자체가 막히면 안 된다.
    // 0009 적용 후 지워도 되는 분기다.
    if (updError?.code === '42703' && 'channel' in updates) {
      const { channel: _dropped, ...withoutChannel } = updates;
      ({ data, error: updError } = await supabase
        .from('requirements')
        .update(withoutChannel)
        .eq('id', id)
        .select()
        .single());
    }
    if (updError) throw updError;

    const { error: logError } = await supabase.from('change_logs').insert({
      requirement_id: id,
      brand_id: brandId,
      changed_by: memberId,
      change_type: '내용수정',
      comment: `${changedFields.join(', ')} 수정`,
    });
    if (logError) throw logError;

    return Response.json({ requirement: data });
  } catch (error) {
    return errorResponse(error);
  }
}

// 영구 삭제. 전체 관리자 전용이고 되돌릴 수 없다.
//
// 반려·취소가 이미 있는데 왜 필요한가: 반려·취소는 "이 요청은 안 한다"는
// 판단을 기록으로 남기는 것이다. 잘못 눌러 만든 빈 건, 테스트로 넣은 건,
// 같은 내용을 세 번 등록한 건에는 남길 판단이 없다. 그런 것까지 쌓이면
// 정작 봐야 할 반려 기록이 소음에 묻힌다.
//
// FK 정리 순서가 이 라우트의 핵심이다. requirements 를 참조하는 테이블 7개 중
// on delete cascade 가 걸린 건 4개(images/links/comments/checklist_items)뿐이고
// change_logs · duplicate_links · in_app_notifications 는 cascade 가 없다.
// 그냥 delete 하면 23503 으로 죽는다.
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { reason } = await request.json();
    // 사유를 받는 이유는 requirement_deletions 한 줄을 채우기 위해서다.
    // 그 한 줄이 이 요구사항에 대해 남는 전부다.
    if (!reason?.trim()) throw new ApiError(400, '삭제 사유를 입력해 주세요.');

    const { memberId } = await requireGlobalAdmin();

    const supabase = getSupabaseAdmin();
    const { data: target, error: targetError } = await supabase
      .from('requirements')
      .select('id, brand_id, title, status, requester:team_members!requirements_requester_fkey(name)')
      .eq('id', id)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) throw new ApiError(404, '요구사항을 찾을 수 없습니다.');

    // 1) 먼저 기록을 남긴다. 이 행을 못 넣으면 삭제도 하지 않는다 —
    //    기록 없이 사라지는 경우를 만들지 않으려고 순서가 이렇다.
    const { error: recordError } = await supabase.from('requirement_deletions').insert({
      requirement_id: id,
      brand_id: target.brand_id,
      title: target.title,
      status: target.status,
      requester_name: target.requester?.name ?? null,
      reason: reason.trim(),
      deleted_by: memberId,
    });
    if (recordError) throw recordError;

    // 2) 이 건이 '중복'으로 다른 건에 병합돼 있었다면 그쪽에 붙은 링크와
    //    duplicate_count 를 되돌린다. 안 하면 대상 요구사항이 "병합된 요청
    //    1건"이라고 표시하면서 정작 그게 뭔지는 못 보여주는 상태가 된다.
    //    linked_note 끝의 ' (#id)' 로 찾는다 — 위 GET 의 mergedInto 와 같은 방식이다.
    const { data: backLinks, error: backError } = await supabase
      .from('duplicate_links')
      .select('id, requirement_id')
      .like('linked_note', `% (#${id})`);
    if (backError) throw backError;
    for (const link of backLinks ?? []) {
      const { error: delLinkError } = await supabase
        .from('duplicate_links')
        .delete()
        .eq('id', link.id);
      if (delLinkError) throw delLinkError;
      const { data: holder } = await supabase
        .from('requirements')
        .select('duplicate_count')
        .eq('id', link.requirement_id)
        .maybeSingle();
      if (holder) {
        await supabase
          .from('requirements')
          .update({ duplicate_count: Math.max(0, (holder.duplicate_count ?? 1) - 1) })
          .eq('id', link.requirement_id);
      }
    }

    // 3) 이미지 파일 경로는 DB 행이 cascade 로 지워지기 전에 읽어 둬야 한다.
    //    Storage 는 FK 를 모르므로 행만 사라지면 파일이 영원히 남는다.
    const { data: imageRows, error: imgListError } = await supabase
      .from('requirement_images')
      .select('storage_path')
      .eq('requirement_id', id);
    if (imgListError) throw imgListError;

    // 4) cascade 가 없는 테이블을 직접 지운다.
    for (const table of ['duplicate_links', 'in_app_notifications', 'change_logs']) {
      const { error } = await supabase.from(table).delete().eq('requirement_id', id);
      if (error) throw error;
    }

    // 5) 본체. 나머지 4개 테이블은 여기서 cascade 로 함께 사라진다.
    const { error: delError } = await supabase.from('requirements').delete().eq('id', id);
    if (delError) throw delError;

    // 6) 파일 정리는 마지막이다. 실패해도 삭제는 이미 끝났으므로 500 으로
    //    돌리지 않는다 — 화면에서 "안 지워졌나?" 하고 다시 누르면 404 만 본다.
    //    남은 파일은 서명 URL 없이는 열 수도 없다.
    const paths = (imageRows ?? []).map((r) => r.storage_path).filter(Boolean);
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from(IMAGE_BUCKET).remove(paths);
      if (storageError) console.error('요구사항 삭제 후 이미지 정리 실패', id, storageError);
    }

    return Response.json({ ok: true, brandId: target.brand_id });
  } catch (error) {
    return errorResponse(error);
  }
}
