import ExcelJS from 'exceljs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireGlobalAdmin } from '@/lib/permissions';
import { errorResponse, ApiError } from '@/lib/apiError';
import { firstLookRows, restRows, templateRow, optionsFrom } from '@/lib/launchTemplate';

// 브랜드에게 줄 엑셀 양식을 내보낸다.
//
// 가이드가 아니라 이 런칭에서 내보낸다 — 양식에 이 브랜드의 오픈일이 반영된
// 실제 기한이 찍혀야 하기 때문이다. 브랜드가 읽는 것은 D-90 이 아니라
// 2026-10-03 이다. 빈 양식의 D-90 은 안 읽힌다.
//
// 451줄을 훑게 하면 안 훑는다. 그래서 01_먼저 볼 것(★ && 결정권=브랜드,
// 보통 57줄)을 맨 앞에 두고 나머지는 02_체크리스트 뒤 시트에 묻는다 —
// 브랜드가 안 봐도 그대로 다시 올라온다(lib/launchTemplate.js).

// 데이터 유효성 목록은 다른 시트를 참조하면 ExcelJS 에서 깨진다는 보고가
// 있어 값을 수식에 직접 넣는다. 그 자리(따옴표 안)의 글자 수 제한이 255자다.
const LIST_LIMIT = 255;

function listFormula(values) {
  const joined = (values ?? []).filter(Boolean).join(',');
  if (!joined || joined.length > LIST_LIMIT) return null;
  return [`"${joined}"`];
}

// 열 번호(1부터) → 엑셀 열 문자(A, B, … Z, AA …). 조건부 서식 수식에서
// $L2 처럼 셀 주소를 직접 써야 해서 필요하다.
function colLetter(n) {
  let s = '';
  let x = n;
  while (x > 0) {
    const rem = (x - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

// 01_먼저 볼 것 · 02_체크리스트가 같은 열 모양을 쓴다(templateRow 의 순서).
// 이름이 아니라 이 배열 하나로 두 시트를 만들어야 모양이 갈리지 않는다.
const COLUMNS = [
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
  { header: '상태', key: '상태', width: 10 },
  { header: '산출물/증빙', key: '산출물/증빙', width: 22 },
  { header: '비고', key: '비고', width: 32 },
];
const COL_AT = Object.fromEntries(COLUMNS.map((c, i) => [c.key, i + 1]));

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
const ID_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
const WARN_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };

// 01/02 시트 하나를 만든다. rows 는 이미 templateRow 를 거친 배열이다.
async function buildTaskSheet(workbook, name, rows, options, warnings) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = COLUMNS;

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
  });

  sheet.addRows(rows);

  // 드롭다운. 결정권·소속은 orgs 를 함께 쓴다 — 같은 조직 이름 세계라서다
  // (lib/launchTemplate.js 의 optionsFrom 주석 참고).
  const dropdowns = {
    상태: listFormula(['해당', '해당없음']),
    주관: listFormula(options.roles),
    지원: listFormula(options.roles),
    결정권: listFormula(options.orgs),
    소속: listFormula(options.orgs),
    채널: listFormula(options.channels),
  };
  for (const [key, formulae] of Object.entries(dropdowns)) {
    const col = COL_AT[key];
    if (!formulae) {
      // 255자를 넘으면 그 열은 드롭다운 없이 둔다 — 못 박느니 비워 둔다.
      if ((options.roles.length || options.orgs.length || options.channels.length) > 0) {
        warnings.push(`${name}: '${key}' 열은 후보가 255자를 넘어 드롭다운을 못 걸었습니다.`);
      }
      continue;
    }
    for (let r = 2; r <= rows.length + 1; r += 1) {
      sheet.getCell(r, col).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae,
      };
    }
  }

  // ID 열은 회색 배경 + 잠금. 나머지 열은 잠금 해제 — 시트 보호를 걸어도
  // 브랜드가 다른 칸은 그대로 고칠 수 있어야 한다.
  const idCol = COL_AT.ID;
  for (let r = 1; r <= rows.length + 1; r += 1) {
    sheet.getRow(r).eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.protection = { locked: colNumber === idCol };
    });
  }
  sheet.getColumn(idCol).fill = ID_FILL;

  // 상태가 해당없음인데 비고가 비면 빨갛게 — 조건부 서식.
  //
  // 미리 칠하지 않고 서식으로 거는 이유: 브랜드가 상태를 바꾸는 순간
  // 즉시 빨개져야 "비워두면 못 올립니다"가 그 자리에서 눈에 띈다.
  if (rows.length > 0) {
    const statusLetter = colLetter(COL_AT.상태);
    const noteLetter = colLetter(COL_AT.비고);
    try {
      sheet.addConditionalFormatting({
        ref: `A2:${colLetter(COLUMNS.length)}${rows.length + 1}`,
        rules: [
          {
            type: 'expression',
            formulae: [`AND($${statusLetter}2="해당없음",$${noteLetter}2="")`],
            style: { fill: WARN_FILL },
          },
        ],
      });
    } catch (err) {
      // ExcelJS 에서 조건부 서식이 실패하면 지금 시점 기준으로 해당하는
      // 줄만 미리 칠해서 대신한다. 편집 후 실시간으로는 못 따라가지만
      // 아무 표시도 없는 것보다는 낫다.
      warnings.push(`${name}: 조건부 서식을 못 걸어 해당 줄을 미리 칠했습니다 (${err.message}).`);
      rows.forEach((row, i) => {
        if (row['상태'] === '해당없음' && !row['비고']) {
          sheet.getRow(i + 2).eachCell((cell) => {
            cell.fill = WARN_FILL;
          });
        }
      });
    }
  }

  // 비밀번호 없이 잠근다 — 브랜드가 못 열면 답이 없다.
  await sheet.protect(undefined, { selectLockedCells: true, selectUnlockedCells: true });

  return sheet;
}

function buildOverviewSheet(workbook, { brandName, openDate, count, today }) {
  const sheet = workbook.addWorksheet('00_먼저 읽기');
  sheet.getColumn(1).width = 90;
  sheet.getColumn(1).alignment = { wrapText: true, vertical: 'top' };

  const lines = [
    `${brandName} 온라인 오픈 — 요건 정리 양식`,
    `오픈 ${openDate} 기준으로 기한이 계산돼 있습니다 · 항목 ${count}건 · ${today} 내려받음`,
    '',
    '세 칸만 보시면 됩니다.',
    "  ① 상태 — 우리 브랜드가 안 하는 일이면 '해당없음' 으로 바꿉니다",
    '  ② 비고 — 해당없음으로 바꿨다면 왜 안 하는지 한 줄. 비워두면 못 올립니다',
    '  ③ 기한 — 우리 일정과 안 맞으면 D-day 를 고칩니다',
    '',
    '없는 항목을 넣으려면 맨 아래에 이어서 쓰시면 됩니다. ID 는 비워두세요 —',
    '올릴 때 모아가 붙입니다.',
    '',
    "지우지 마세요. 안 하는 항목도 '해당없음' 으로 남겨야 다음 브랜드가",
    '"왜 안 했지"를 알 수 있습니다.',
    '',
    '회색 칸(ID)은 잠겨 있습니다. 주관·지원·결정권·채널은 목록에서 고릅니다 —',
    '직접 쓰면 이름이 갈립니다.',
    '',
    '이 파일로 정리하는 것은 시작할 때 한 번입니다. 시작한 뒤에는 모아에서',
    '관리합니다.',
  ];
  lines.forEach((line, i) => {
    const row = sheet.getRow(i + 1);
    row.getCell(1).value = line;
    if (i === 0) row.getCell(1).font = { bold: true, size: 14 };
  });
}

const DECISION_HEADERS = ['시기', '결정 항목', '미결 시 영향', '결정 주체', '상태', '결정 내용', '비고'];

function buildDecisionSheet(workbook, decisions) {
  const sheet = workbook.addWorksheet('03_먼저 결정할 것');
  sheet.columns = DECISION_HEADERS.map((h) => ({ header: h, key: h, width: h === '미결 시 영향' ? 40 : 18 }));
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
  });
  // launch_decisions 가 있으면 채우고, 없으면 머리만 남긴다 — 회의에서
  // 실제로 다투는 항목이 아직 안 정해진 런칭도 있기 때문이다.
  for (const d of decisions ?? []) {
    sheet.addRow({
      시기: d.when_text ?? '',
      '결정 항목': d.title ?? '',
      '미결 시 영향': d.impact ?? '',
      '결정 주체': d.owner_text ?? '',
      상태: d.status ?? '',
      '결정 내용': d.decided_note ?? '',
      비고: d.note ?? '',
    });
  }
}

function buildReferenceSheet(workbook, options) {
  const sheet = workbook.addWorksheet('참고_역할·조직', { state: 'veryHidden' });
  const cols = [
    { key: 'workstreams', header: '워크스트림', list: options.workstreams },
    { key: 'roles', header: '역할(주관·지원)', list: options.roles },
    { key: 'orgs', header: '조직(결정권·소속)', list: options.orgs },
    { key: 'channels', header: '채널', list: options.channels },
  ];
  sheet.columns = cols.map((c) => ({ header: c.header, key: c.key, width: 20 }));
  sheet.getRow(1).font = { bold: true };
  const max = Math.max(0, ...cols.map((c) => c.list.length));
  for (let i = 0; i < max; i += 1) {
    const row = {};
    cols.forEach((c) => {
      row[c.key] = c.list[i] ?? '';
    });
    sheet.addRow(row);
  }
}

function fileName(brandName, today) {
  const safe = (brandName ?? '').replace(/[\\/:*?"<>|]/g, '').trim() || '브랜드';
  const stamp = today.replace(/-/g, '');
  return `${safe}_온라인오픈_요건정리_${stamp}.xlsx`;
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
    if (!launch.open_date) throw new ApiError(400, '오픈일이 없어 양식을 만들 수 없습니다.');

    const { data: tasks, error: tErr } = await supabase
      .from('launch_tasks')
      .select(
        'id, code, workstream, category, title, channel, decision_org, owner_org, owner_role, support_role, depends_on, day_offset, deliverable, note, is_critical, sort_order, status, excluded_reason',
      )
      .eq('launch_id', id)
      .order('workstream', { ascending: true })
      .order('sort_order', { ascending: true });
    if (tErr) throw tErr;

    // '먼저 결정할 것'은 다른 에이전트가 만드는 launch_decisions API 와
    // 별개로, 여기서는 표시만 하므로 테이블을 직접 읽는다 — 쓰지 않는다.
    const { data: decisions, error: dErr } = await supabase
      .from('launch_decisions')
      .select('seq, when_text, title, impact, owner_text, status, decided_note, note')
      .eq('launch_id', id)
      .order('seq', { ascending: true });
    if (dErr) throw dErr;

    const allTasks = tasks ?? [];
    const options = optionsFrom(allTasks);
    const today = new Date().toISOString().slice(0, 10);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '모아';
    workbook.created = new Date();

    buildOverviewSheet(workbook, {
      brandName: launch.name,
      openDate: launch.open_date,
      count: allTasks.length,
      today,
    });

    const warnings = [];
    const firstRows = firstLookRows(allTasks).map((t) => templateRow({ task: t, openDate: launch.open_date }));
    const otherRows = restRows(allTasks).map((t) => templateRow({ task: t, openDate: launch.open_date }));
    await buildTaskSheet(workbook, '01_먼저 볼 것', firstRows, options, warnings);
    await buildTaskSheet(workbook, '02_체크리스트', otherRows, options, warnings);

    buildDecisionSheet(workbook, decisions);
    buildReferenceSheet(workbook, options);

    if (warnings.length > 0) console.warn('[launch/template]', warnings.join(' | '));

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
