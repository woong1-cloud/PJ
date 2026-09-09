-- 0037: 협조 요청은 댓글이다
--
-- 새 테이블을 안 만든다. 요청의 본체는 사람이 쓴 한마디이고, 그것이 활동에
-- 남아야 "언제 누구에게 요청했더라"에 답이 된다 — 댓글이 이미 그 자리다.
--
-- 이 칸이 비어 있으면 평범한 댓글, 차 있으면 협조 요청이다. 그래서 활동에서
-- 다르게 그릴 수 있고, 24시간 안에 또 보내는 것도 이 칸으로 찾는다.
--
-- 인덱스는 새로 안 만든다. 24시간 검사가 (항목, 시각)으로 훑는데
-- idx_launch_task_comments_task 가 이미 (task_id, created_at) 이다.
alter table launch_task_comments
  add column if not exists request_roles text[];
