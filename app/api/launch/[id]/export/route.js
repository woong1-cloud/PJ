import ExcelJS from 'exceljs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { statusRow } from '@/lib/launchTemplate';
import { progress, isDone, isLate, isNotApplicable } from '@/lib/launchTask';
import { launchDDay } from '@/lib/launchDate';
import { todayInKst } from '@/lib/overdue';

// 현황 내보내기 — 지금 상태를 그대로 찍는다.
//
// 양식(template/route.js)과 목적이 다르다. 양식은 브랜드가 채울 빈 칸이고,
// 이건 회의 자료·보고·보관용이라 진행 정보가 전부 들어간다. 그래서 57줄로
// 자르지 않는다 — 회의에서 볼 것은 "브랜드가 뭘 채워야 하나"가 아니라
// "지금 어디까지 왔나"이고, 그건 476건 전부를 봐야 답할 수 있다.
//
// 드롭다운·시트 보호·조건부 서식을 안 넣는다. 읽는 파일이라 필요 없고,
// 여는 속도만 늦춘다.

// 세는 규칙은 반드시 lib/launchTask.js 의 progress() 를 쓴다. 여기서 새로
// 세면 화면(보드)과 이 파일의 숫자가 갈리고, 그때부터 "회의에서 본 숫자와
// 다르다"는 신뢰 문제가 생긴다.

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
// 지남 — 옅은 붉은색. 눈에 띄되 경보처럼 강렬하지 않게.
const LATE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4E4' } };
// 완료 — 흐리게. 더 볼 일이 없는 줄이라는 뜻이다.
const DONE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
// 해당없음 — 회색. 이 브랜드에는 없는 일이라는 뜻이다.
const NA_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E5E5' } };

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

// 01_전체의 열 모양. statusRow 가 만드는 키와 순서가 정확히 같아야 한다 —
// 다르면 addRows 가 엉뚱한 칸에 값을 넣거나(키로 찾으므로 실제로는 안
// 그러지만) 열 너비가 안 맞는 열에 걸린다.
const STATUS_COLUMNS = [
  { header: 'ID', key: 'ID', width: 10 },
  { header: '결정권', key: '결정권', width: 12 },
  { header: '소속', key: '소속', width: 14 },
  { header: '주관', key: '주관', width: 12 },
  { header: '지원', key: '지원', width: 12 },
  { header: '대분류', key: '대분류', width: 16 },
  { header: '체크 항목', key: '체크 항목', width: 54 },
  { header: '채널', key: '채널', width: 10 },
  { header: '선행조건', key: '선행조건', width: 16 },
  { header: 'D-day', key: 'D-day', width: 8 },
  { header: '기한', key: '기한', width: 12 },
  { header: '산출물/증빙', key: '산출물/증빙', width: 22 },
  { header: '비고', key: '비고', width: 24 },
  { header: '상태', key: '상태', width: 10 },
  { header: '담당자', key: '담당자', width: 12 },
  { header: '완료일', key: '완료일', width: 12 },
  { header: '막힌 이유', key: '막힌 이유', width: 24 },
  { header: '기다리는 결정', key: '기다리는 결정', width: 22 },
  { header: '해당없음 사유', key: '해당없음 사유', width: 24 },
  { header: '출처', key: '출처', width: 10 },
  { header: '쉬운 설명', key: '쉬운 설명', width: 34 },
];

const DECISION_HEADERS = ['시기', '결정 항목', '미결 시 영향', '결정 주체', '상태', '결정 내용', '결정일'];

// 01_전체 한 시트. tasks 전부(해당없음 포함)를 statusRow 로 찍는다.
function buildStatusSheet(workbook, tasks, { openDate, today, decisionsById }) {
  const sheet = workbook.addWorksheet('01_전체', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = STATUS_COLUMNS;

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
  });

  tasks.forEach((task) => {
    const row = sheet.addRow(statusRow({ task, openDate, decisionsById }));
    // 상태별 줄 색. 우선순위: 해당없음 > 완료 > 지남 — 해당없음·완료는
    // isLate 가 이미 false 를 주지만(lib/launchTask.js), 색은 겹치지 않게
    // 한 번만 칠한다.
    let fill = null;
    if (isNotApplicable(task)) fill = NA_FILL;
    else if (isDone(task)) fill = DONE_FILL;
    else if (isLate({ task, openDate, today })) fill = LATE_FILL;
    if (fill) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = fill;
      });
    }
  });

  return sheet;
}

function buildDecisionSheet(workbook, decisions) {
  const sheet = workbook.addWorksheet('02_결정');
  sheet.columns = DECISION_HEADERS.map((h) => ({ header: h, key: h, width: h === '미결 시 영향' ? 40 : 18 }));
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
  });
  for (const d of decisions ?? []) {
    sheet.addRow({
      시기: d.when_text ?? '',
      '결정 항목': d.title ?? '',
      '미결 시 영향': d.impact ?? '',
      '결정 주체': d.owner_text ?? '',
      상태: d.status ?? '',
      '결정 내용': d.decided_note ?? '',
      결정일: text(d.decided_at).slice(0, 10),
    });
  }
}

// [워크스트림별] 줄. tasks 는 이미 workstream 순으로 정렬돼 온다(쿼리의
// order) — 그 순서를 그대로 따라야 시트 순서와 요약 순서가 같아 보인다.
function workstreamOrder(tasks) {
  const seen = new Set();
  const order = [];
  for (const t of tasks) {
    const ws = text(t.workstream);
    if (ws && !seen.has(ws)) {
      seen.add(ws);
      order.push(ws);
    }
  }
  return order;
}

function buildSummarySheet(workbook, { brandName, openDate, today, tasks, context, decisions }) {
  const sheet = workbook.addWorksheet('00_요약');
  sheet.getColumn(1).width = 22;
  sheet.getColumn(2).width = 56;
  sheet.getColumn(2).alignment = { wrapText: true, vertical: 'top' };

  let r = 1;
  const write = (a, b, opts = {}) => {
    const row = sheet.getRow(r);
    row.getCell(1).value = a ?? '';
    if (b !== undefined) row.getCell(2).value = b;
    if (opts.bold) row.getCell(1).font = { bold: true, size: opts.size };
    r += 1;
    return row;
  };

  write(`${brandName} — 온라인 오픈 현황`, undefined, { bold: true, size: 14 });
  const dday = launchDDay(openDate, today) ?? '';
  write(`오픈 ${openDate ?? ''} · ${dday} · ${today} 기준`);
  r += 1;

  const p = progress({ tasks, openDate, today });
  const pendingDecisions = (decisions ?? []).filter((d) => d.status === '대기').length;
  write('완료', `${p.done} / ${p.total}   (${p.percent}%)`);
  write('이번 주 마감', p.thisWeek);
  write('기한 지남', p.late);
  write('막힘', p.blocked);
  write('해당없음', p.notApplicable);
  write('결정 대기', `${pendingDecisions} / ${(decisions ?? []).length}`);
  r += 1;

  write('[전제]', undefined, { bold: true });
  const premises = Array.isArray(context) ? context : [];
  if (premises.length === 0) {
    write('(등록된 전제 없음)');
  } else {
    for (const item of premises) {
      write(text(item?.label), text(item?.value));
    }
  }
  r += 1;

  write('[워크스트림별]', undefined, { bold: true });
  for (const ws of workstreamOrder(tasks)) {
    const wsTasks = tasks.filter((t) => t.workstream === ws);
    const wp = progress({ tasks: wsTasks, openDate, today });
    write(ws, `${wp.done}/${wp.total}   지남 ${wp.late}`);
  }
}

function fileName(brandName, today) {
  const safe = (brandName ?? '').replace(/[\\/:*?"<>|]/g, '').trim() || '브랜드';
  const stamp = today.replace(/-/g, '');
  return `${safe}_온라인오픈_현황_${stamp}.xlsx`;
}

export async function GET(request, { params }) {
  try {
    await requireGlobalAdmin();
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: launch, error: lErr } = await supabase
      .from('launches')
      .select('id, name, open_date, status, context')
      .eq('id', id)
      .maybeSingle();
    if (lErr) throw lErr;
    if (!launch) throw new ApiError(404, '런칭을 찾을 수 없습니다.');

    const { data: tasks, error: tErr } = await supabase
      .from('launch_tasks')
      .select(
        'id, code, workstream, category, title, channel, decision_org, owner_org, owner_role, support_role, depends_on, day_offset, deliverable, note, is_critical, sort_order, status, excluded_reason, assignee_name, done_at, blocked_reason, blocked_decision_id, source, plain_text',
      )
      .eq('launch_id', id)
      .order('workstream', { ascending: true })
      .order('sort_order', { ascending: true });
    if (tErr) throw tErr;

    // launch_decisions 는 다른 에이전트가 만든 API 와 별개로, 여기서는
    // 표시만 하므로 테이블을 직접 읽는다 — 쓰지 않는다.
    const { data: decisions, error: dErr } = await supabase
      .from('launch_decisions')
      .select('id, seq, when_text, title, impact, owner_text, status, decided_note, decided_at')
      .eq('launch_id', id)
      .order('seq', { ascending: true });
    if (dErr) throw dErr;

    const allTasks = tasks ?? [];
    const allDecisions = decisions ?? [];
    const decisionsById = new Map(allDecisions.map((d) => [d.id, d]));
    const today = todayInKst();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '모아';
    workbook.created = new Date();

    buildSummarySheet(workbook, {
      brandName: launch.name,
      openDate: launch.open_date,
      today,
      tasks: allTasks,
      context: launch.context,
      decisions: allDecisions,
    });

    buildStatusSheet(workbook, allTasks, { openDate: launch.open_date, today, decisionsById });
    buildDecisionSheet(workbook, allDecisions);

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName(launch.name, today))}`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
