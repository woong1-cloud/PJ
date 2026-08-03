import { typeLabel } from './requirementTypes';

// CSV 만들기.
//
// 이 파일이 순수 함수로 따로 있는 이유는 CSV 가 조용히 틀리는 형식이기
// 때문이다. 제목에 쉼표가 하나 들어가면 열이 밀리는데, 엑셀은 오류를 내지
// 않고 그냥 이상한 표를 보여준다. 사람이 눈치채지 못한 채로 보고에 쓴다.

// 엑셀은 UTF-8 CSV 를 열 때 BOM 이 없으면 시스템 인코딩(한국 윈도우면 CP949)
// 으로 읽는다. 그러면 한글이 전부 깨진다 — 이 한 글자가 없어서 "CSV 가
// 깨져요"가 되는 경우가 대부분이다.
export const BOM = '﻿';

// 값 하나를 CSV 칸으로.
//
// 쉼표·따옴표·줄바꿈이 있으면 통째로 따옴표로 감싸고, 안의 따옴표는 두 번
// 겹쳐 쓴다(RFC 4180). 감싸지 않으면 열이 밀리고, 겹쳐 쓰지 않으면 따옴표가
// 칸을 일찍 닫는다.
export function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (!/[",\r\n]/.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv({ headers, rows }) {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows ?? []) {
    lines.push(row.map(escapeCell).join(','));
  }
  // 엑셀은 \n 만 있어도 읽지만, 다른 도구를 위해 CRLF 로 맞춘다(RFC 4180).
  return BOM + lines.join('\r\n');
}

// 요구사항 목록 → CSV.
//
// As-Is·To-Be·비고는 넣지 않는다. 목록 API 가 그 값을 가져오지 않기도 하고,
// 문단 단위 본문이 섞이면 표가 세로로 늘어나 읽을 수 없게 된다. CSV 의 쓰임은
// "무엇이 몇 건 있고 어디까지 왔나"를 옮겨 담는 것이지 본문 백업이 아니다.
export const REQUIREMENT_CSV_HEADERS = [
  '유형',
  '상태',
  '채널',
  '제목',
  '카테고리',
  '우선순위',
  '요청자',
  '담당자',
  '요청일',
  '예상 배포일',
  '완료일',
  '프로젝트',
  '레드마인',
  '첨부',
];

export function requirementsToCsv(requirements) {
  const rows = (requirements ?? []).map((r) => [
    typeLabel(r.requirement_type),
    r.status ?? '',
    r.channel ?? '',
    r.title ?? '',
    r.category?.category_name ?? '',
    r.priority ?? '',
    r.requester?.name ?? '',
    r.assignee?.name ?? '',
    r.request_date ?? '',
    r.expected_release_date ?? '',
    // 완료일은 타임스탬프라 날짜만 남긴다. 시각까지 넣으면 칸이 길어지고
    // 엑셀에서 정렬할 때 형식이 섞인다.
    r.completed_at ? r.completed_at.slice(0, 10) : '',
    r.project?.name ?? '',
    r.redmine_url ?? '',
    r.image_count ?? 0,
  ]);
  return toCsv({ headers: REQUIREMENT_CSV_HEADERS, rows });
}

// 다운로드 파일명. 날짜를 넣어야 여러 번 받았을 때 구분된다.
//
// 브랜드 이름을 넣는 이유: 브랜드를 바꿔 가며 두세 번 받으면 어느 것이 어느
// 브랜드인지 파일명 말고는 알 방법이 없다.
export function csvFileName(brandName, today) {
  const safe = (brandName ?? '').replace(/[\\/:*?"<>|]/g, '').trim();
  return safe ? `${safe}_요구사항_${today}.csv` : `요구사항_${today}.csv`;
}
