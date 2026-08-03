-- 0019: 요구사항 유형 + 파일 첨부
--
-- 1) requirement_type
--
-- 지금은 "받은 요청의 절반이 오류다" 같은 말을 데이터로 할 수 없다. 카테고리가
-- 있지만 그건 브랜드별 업무 영역이라 다른 축이다.
--
-- 기본값을 두지 않는다(null 허용). 기존 9건에 임의로 '신규'를 박으면 그건
-- 거짓 데이터다 — 아무도 그렇게 분류한 적이 없다. 미분류로 두고 필요하면
-- 손으로 채운다. 새로 등록되는 건은 화면에서 필수로 받는다.
--
-- 값을 넷으로 좁힌 이유: 다섯 개가 넘으면 등록자가 고민하다 아무거나 고르고,
-- 그 순간 이 컬럼은 있으나 마나가 된다. 나중에 값을 늘리는 것은 CHECK 하나
-- 고치면 되지만(기존 행은 그대로 유효하다), 줄이는 것은 데이터 변환이 따른다.
alter table requirements add column if not exists requirement_type text
  check (requirement_type in ('신규','개선','오류','문의'));

comment on column requirements.requirement_type is
  '요구사항 유형. null 은 0019 이전에 등록된 건(미분류).';

-- 2) requirement_images.file_name
--
-- 이미지는 썸네일로 보여주면 되지만 PDF·엑셀·PPT 는 원래 파일 이름이 없으면
-- 화면에 보여줄 것이 없다. Storage 경로는 uuid 라 사람이 읽을 수 없다.
--
-- 테이블 이름은 requirement_images 그대로 둔다. 이제 이미지가 아닌 것도
-- 담지만, 이름을 바꾸려면 마이그레이션과 코드 전체의 참조를 함께 고쳐야 하고
-- 얻는 것은 이름 하나다. content_type 으로 이미지/파일을 갈라 쓴다.
alter table requirement_images add column if not exists file_name text;

comment on column requirement_images.file_name is
  '원본 파일명. 이미지는 비어 있어도 되지만 문서 첨부는 이 값으로 표시한다.';
