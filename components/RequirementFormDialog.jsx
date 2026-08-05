'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageDropzone } from '@/components/ImageDropzone';
import { CHANNELS } from '@/lib/channels';
import { normalizeUrl } from '@/lib/links';
import { REQUIREMENT_TYPES, TYPE_HINTS } from '@/lib/requirementTypes';

const LEVELS = ['상', '중', '하'];
const LEVEL_STYLE = {
  상: { on: 'border-rose-300 bg-rose-50 text-rose-600', off: 'border-slate-200 text-slate-400 hover:bg-slate-50' },
  중: { on: 'border-amber-300 bg-amber-50 text-amber-700', off: 'border-slate-200 text-slate-400 hover:bg-slate-50' },
  하: { on: 'border-slate-300 bg-slate-100 text-slate-600', off: 'border-slate-200 text-slate-400 hover:bg-slate-50' },
};

// 버튼 높이를 h-8 로 고정한다. 옆 칸의 Select 트리거·Input 이 h-8 인데 py 로
// 잡으면 34px 이 되어 2px 어긋나고, 나란히 둔 두 칸의 밑선이 안 맞는다.
function LevelSelect({ id, value, onChange }) {
  return (
    <div id={id} className="flex gap-1.5">
      {LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => onChange(value === level ? '' : level)}
          className={`h-8 flex-1 rounded-lg border px-2 text-sm transition-colors ${
            value === level ? LEVEL_STYLE[level].on : LEVEL_STYLE[level].off
          }`}
        >
          {level}
        </button>
      ))}
    </div>
  );
}

function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emptyForm() {
  return {
    title: '',
    priority: '',
    requestDate: todayLocal(),
    category: 'none',
    // 채널은 기본값을 두지 않는다.
    //
    // 예전에는 '공통'이 미리 박혀 있었다. 아무도 안 건드리면 전부 공통이
    // 되는데, 그게 그럴듯한 값이라 틀린 줄도 모른다 — 유형처럼 빈칸으로
    // 보이면 눈에 띄지만, '공통'은 누군가 고른 값처럼 보인다.
    //
    // 그래서 유형과 반대로 필수로 받는다. 유형은 등록하는 사람이 판단하지
    // 못할 수 있는 값이고, 채널("내가 어디에 대해 요청하는가")은 모를 수가
    // 없는 값이다. 모르는 값은 비워 두게 하고, 아는 값은 받아 낸다.
    channel: '',
    // 유형은 기본값을 두지 않는다. '신규'를 미리 박아 두면 오류 신고까지
    // 신규로 들어오고, 그 순간 이 값은 집계에 쓸 수 없게 된다.
    requirementType: '',
    projectId: 'none',
    asIs: '',
    toBe: '',
    note: '',
    isConfidential: false,
  };
}

export function RequirementFormDialog({ open, onOpenChange, categories, projects = [], identity, onCreated }) {
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  // 모바일에서만 쓰인다. 데스크톱은 CSS 로 늘 펼쳐 두므로 이 값과 무관하다.
  const [typeHelpOpen, setTypeHelpOpen] = useState(false);
  // 참고 링크. 요구사항이 만들어진 뒤에 붙이므로 이미지와 같은 방식으로
  // 여기 모아 뒀다가 등록 후에 보낸다.
  const [links, setLinks] = useState([]);
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');

  function addLink() {
    const normalized = normalizeUrl(linkUrl);
    if (!normalized) {
      setLinkError('http 또는 https 주소만 넣을 수 있습니다.');
      return;
    }
    setLinks((prev) => [...prev, { label: linkLabel.trim(), url: normalized }]);
    setLinkLabel('');
    setLinkUrl('');
    setLinkError('');
  }

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // 제출 없이(Esc·바깥 클릭·닫기 버튼) 다이얼로그를 닫으면 이전 입력이 다음에 열었을 때
  // 그대로 남아있지 않도록 초기화한다.
  function handleOpenChange(next) {
    if (!next) {
      setForm(emptyForm());
      setImageFiles([]);
      setLinks([]);
      setLinkLabel('');
      setLinkUrl('');
      setLinkError('');
      setError('');
    }
    onOpenChange(next);
  }

  // submitForReview: true 면 검토대기로, false 면 작성중(임시저장)으로 만든다.
  //
  // 두 버튼으로 나눈 이유: 예전에는 등록이 무조건 작성중이었고, 4차 요청자는
  // 거기서 검토대기로 올릴 방법이 없었다(상태 변경은 3차 이상). 올린 사람은
  // 접수됐다고 믿고 IT 는 존재를 몰랐다.
  //
  // 그렇다고 등록=제출로만 두면 초안을 잡아 둘 방법이 없어진다 — 이미지를
  // 나중에 붙이거나 내용을 더 다듬으려는 경우가 실제로 있다. 그래서 둘 다 둔다.
  async function handleSubmit(event, submitForReview) {
    event.preventDefault();

    // 임시저장에도 똑같이 건다. 초안이라고 봐주면 그 초안이 그대로 제출되고,
    // 서버의 기본값(공통)이 조용히 채워진다 — 막으려던 그 일이다.
    //
    // 제목의 required 는 브라우저가 봐 주지만 그건 type="submit" 일 때뿐이고,
    // 임시저장은 type="button" 이라 검사가 돌지 않는다. 채널은 Select 라
    // 어느 쪽이든 브라우저가 봐 주지 않으므로 여기서 직접 본다.
    if (!form.channel) {
      setError('채널을 선택해 주세요.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: identity.brandId,
          title: form.title,
          priority: form.priority || null,
          requestDate: form.requestDate,
          category: form.category === 'none' ? null : form.category,
          channel: form.channel,
          requirementType: form.requirementType,
          asIs: form.asIs,
          toBe: form.toBe,
          note: form.note,
          isConfidential: form.isConfidential,
          submit: submitForReview === true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '등록에 실패했습니다.');
      const created = data.requirement;

      // 본문 저장 이후의 부수 작업들은 실패해도 요구사항 자체는 이미 만들어진 상태다.
      // 그래서 예외로 중단하지 않고 경고만 모은다. 하나라도 모이면 다이얼로그를 닫지
      // 않는다 — 닫으면 애니메이션과 함께 메시지가 바로 사라져 사용자가 못 읽는다.
      const warnings = [];

      // 프로젝트 연결은 POST가 아니라 PATCH로 한다 — 전개 대상 브랜드 자동 추가
      // 규칙이 그 라우트에만 있기 때문이다.
      if (form.projectId !== 'none' && created?.id) {
        const linkRes = await fetch(`/api/requirements/${created.id}/project`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: form.projectId }),
        });
        if (!linkRes.ok) {
          const linkData = await linkRes.json();
          // 상세 화면에서 다시 연결할 수 있다.
          warnings.push(`프로젝트 연결에 실패했습니다(${linkData.error ?? ''})`);
        }
      }

      if (imageFiles.length > 0 && created?.id) {
        try {
          const fd = new FormData();
          fd.append('brandId', identity.brandId);
          imageFiles.forEach((f) => fd.append('files', f));
          const imgRes = await fetch(`/api/requirements/${created.id}/images`, {
            method: 'POST',
            body: fd,
          });
          if (!imgRes.ok) {
            const imgData = await imgRes.json();
            throw new Error(imgData.error ?? '이미지 업로드에 실패했습니다.');
          }
        } catch (imgErr) {
          // 상세에서 이미지 재시도 가능.
          warnings.push(`이미지 업로드에 실패했습니다(${imgErr.message})`);
        }
      }

      // 링크도 요구사항이 만들어진 뒤에 붙는다. 이미지와 같이 실패해도 본문은
      // 이미 저장된 상태라 경고만 모은다 — 상세 화면에서 다시 붙일 수 있다.
      if (links.length > 0 && created?.id) {
        const failed = [];
        for (const link of links) {
          const res = await fetch(`/api/requirements/${created.id}/links`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brandId: identity.brandId, label: link.label, url: link.url }),
          });
          if (!res.ok) failed.push(link.label || link.url);
        }
        if (failed.length > 0) warnings.push(`링크 저장에 실패했습니다(${failed.join(', ')})`);
      }

      setForm(emptyForm());
      setImageFiles([]);
      setLinks([]);
      onCreated();
      if (warnings.length > 0) {
        setError(`요구사항은 등록됐지만 ${warnings.join(' / ')}`);
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>새 요구사항 등록</DialogTitle>
        </DialogHeader>
        {/* 엔터 키로 제출될 때도 '검토 요청'이 되게 둔다. 등록하러 들어온
            사람의 기본 의도는 제출이고, 임시저장은 명시적으로 누르는 행동이다. */}
        <form onSubmit={(e) => handleSubmit(e, true)} className="flex flex-col gap-4">
          {/* 왼쪽 본문, 오른쪽 속성.
              상세 화면이 이미 같은 구조라(본문 왼쪽, 메타 오른쪽) 등록과 조회를
              한 번만 배우면 된다.
              모바일에서는 한 열로 떨어져 예전과 똑같이 세로로 쌓인다 — 화면을
              두 벌로 만들지 않는 이유가 이것이다. 필드가 늘 때 고칠 곳이 한
              군데뿐이고, 한쪽만 고치는 사고가 나지 않는다. */}
          <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="title">제목</Label>
                {/* 플레이스홀더는 설명이 아니라 예시다. "여기에 현재 문제를
                    적으세요"는 아무도 안 읽지만, 잘 쓴 문장 하나는 따라 쓴다.
                    실제로 올라온 건들을 보면 본문 품질이 갈리는 지점은
                    '영향을 적었는가' 하나다.

                    다만 여러 줄짜리 완성된 문장을 넣었더니 이미 작성된 초안처럼
                    보였다. 그래서 '예)' 를 붙이고 한 줄로 줄인다 — 예시라는 것이
                    글자 자체로 드러나야 한다. */}
                <Input
                  id="title"
                  placeholder="예) 상세페이지에 배송 예정일 노출"
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="asIs">As-Is</Label>
                {/* 뒷부분이 핵심이다. "무엇이 안 된다"만 쓰면 IT 가 우선순위를
                    매길 수 없다. 예시에 영향이 숫자로 들어가 있으면 따라 쓴다. */}
                <Textarea
                  id="asIs"
                  rows={4}
                  placeholder={'예) 배송 안내가 없어 "언제 받나요" 문의가 하루 20건씩 들어옵니다'}
                  value={form.asIs}
                  onChange={(e) => updateField('asIs', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="toBe">To-Be</Label>
                <Textarea
                  id="toBe"
                  rows={4}
                  placeholder={'예) 가격 아래에 "내일(화) 도착 예정" 노출, 재고 없으면 숨김'}
                  value={form.toBe}
                  onChange={(e) => updateField('toBe', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="note">비고</Label>
                {/* 링크를 여기 적으라고 안내하지 않는다. 참고 링크는 아래에
                    자기 자리가 있다 — 비고에 주소를 적으면 클릭이 안 되고 어떤
                    것이 시안이고 어떤 것이 지표인지 알 수 없다. */}
                <Textarea
                  id="note"
                  rows={3}
                  placeholder="예) 9월 프로모션 전에 필요합니다"
                  value={form.note}
                  onChange={(e) => updateField('note', e.target.value)}
                />
              </div>

              {/* 첨부는 속성이 아니라 내용이다. 기획서와 스크린샷은 요구사항의
                  일부지 메타데이터가 아니므로 본문 쪽에 둔다.
                  실용적인 이유도 있다 — 파일을 넷다섯 붙이면 썸네일이 격자로
                  깔리는데, 오른쪽 좁은 칸에서는 그게 답답하다. 그리고 오른쪽만
                  길어져 왼쪽 아래가 비던 것도 이걸로 메워진다. */}
              <div className="flex flex-col gap-1">
                <Label>첨부</Label>
                <ImageDropzone
                  files={imageFiles}
                  onAdd={(added) => setImageFiles((prev) => [...prev, ...added])}
                  onRemove={(i) => setImageFiles((prev) => prev.filter((_, idx) => idx !== i))}
                />
              </div>

              {/* 참고 링크. 예전에는 상세 화면에 들어가야만 붙일 수 있었는데,
                  실제 데이터를 보면 아무도 나중에 돌아오지 않는다(첨부 0건,
                  코멘트 1건). 시안·대시보드 주소를 손에 들고 있는 시점은
                  등록할 때뿐이라 그 자리에 둔다.

                  평소에는 한 줄로 접어 둔다. 필드가 이미 열한 개인데 링크를
                  늘 펼쳐 두면 안 쓰는 사람에게는 소음이다. */}
              <div className="flex flex-col gap-2">
                {/* 라벨이 이 줄의 존재 이유다. 폼의 다른 필드에는 전부 라벨이
                    있는데 여기만 없어서, 두 칸이 무슨 묶음인지 모른 채 '이름'만
                    보였다. 첨부 드롭존 바로 아래라 첨부의 일부로 읽히기까지 했다. */}
                <Label>참고 링크</Label>
                {links.map((link, i) => (
                  <div
                    key={`${link.url}-${i}`}
                    className="flex items-center gap-2 text-sm text-slate-600"
                  >
                    <span className="shrink-0 text-slate-400">🔗</span>
                    <span className="min-w-0 flex-1 truncate" title={link.url}>
                      {link.label || link.url}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLinks((prev) => prev.filter((_, idx) => idx !== i))}
                      className="shrink-0 text-xs text-slate-400 hover:text-slate-600"
                      aria-label="링크 빼기"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* 주소가 앞이다. 필수인 쪽이 먼저 와야 한다 — 선택 항목인
                    이름이 앞에 있으니 "먼저 이름부터 지어야 하나?" 로 읽혔다. */}
                <div className="flex flex-col gap-1.5 sm:flex-row">
                  <Input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    // 엔터가 폼 전체를 제출하면 링크만 넣으려던 사람이 요구사항을
                    // 올려 버린다. 여기서는 엔터가 '추가'다.
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addLink();
                      }
                    }}
                    placeholder="https://..."
                    className="h-11 sm:h-8 sm:flex-1"
                  />
                  <Input
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    // 무엇을 적는 칸인지 예시 하나로 드러낸다. '이름 (선택)'은
                    // 무엇의 이름인지 알 수 없다.
                    placeholder="예) 기획안"
                    className="h-11 sm:h-8 sm:w-28"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addLink}
                    disabled={!linkUrl.trim()}
                    className="h-11 sm:h-8"
                  >
                    추가
                  </Button>
                </div>
                {linkError && <p className="text-xs text-red-600">{linkError}</p>}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {/* 짧은 값은 둘씩 묶는다. 셀렉트 하나가 한 줄을 통째로 쓸 이유가
                  없고, 그렇게 두면 폼이 세로로만 길어진다.
                  필수인 채널이 맨 앞이다. 예전에는 유형이 먼저였는데 그건
                  필수가 아니다 — 모바일에서 세로로 떨어질 때 필수값이 뒤에
                  오면 스크롤 저 아래에서 처음 만나게 된다. */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="channel">
                    채널 <span className="text-rose-500">*</span>
                  </Label>
                  <Select
                    items={CHANNELS.map((c) => ({ value: c, label: c }))}
                    value={form.channel || null}
                    onValueChange={(value) => updateField('channel', value)}
                  >
                    <SelectTrigger id="channel" className="h-11 w-full md:h-8">
                      <SelectValue placeholder="선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="requirementType">유형</Label>
                  <Select
                    items={REQUIREMENT_TYPES.map((t) => ({ value: t, label: t }))}
                    value={form.requirementType || null}
                    onValueChange={(value) => updateField('requirementType', value)}
                  >
                    <SelectTrigger id="requirementType" className="h-11 w-full md:h-8">
                      <SelectValue placeholder="선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {REQUIREMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 유형은 등록하는 사람이 늘 판단할 수 있는 값이 아니다. 온라인 MD
                  입장에서 "이게 신규 과제인지 기존 개선인지"가 애매한 경우가
                  실제로 많고, 억지로 고르게 하면 아무거나 골라 데이터가 더
                  더러워진다. 그래서 필수가 아니고, 그 사실과 네 값의 뜻을
                  여기서 밝힌다. 비워 두면 IT 가 착수할 때 채운다.

                  안내 박스는 네 줄짜리라 모바일 화면의 삼분의 일을 먹는다.
                  그래서 모바일에서는 접어 두고 버튼으로 편다. 데스크톱은 자리가
                  있으므로 늘 펼친 채로 둔다 — 하이드레이션이 어긋나지 않게
                  화면 폭을 자바스크립트로 재지 않고 CSS 로만 가른다. */}
              {form.requirementType ? (
                <p className="text-xs text-slate-500">{TYPE_HINTS[form.requirementType]}</p>
              ) : (
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setTypeHelpOpen((v) => !v)}
                    className="self-start text-xs text-indigo-600 underline md:hidden"
                  >
                    {typeHelpOpen ? '유형 설명 접기' : '유형이 뭔가요?'}
                  </button>
                  <div
                    className={`${typeHelpOpen ? 'block' : 'hidden'} rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs break-keep text-slate-500 md:block`}
                  >
                    <p className="mb-1 text-slate-600">
                      모르겠으면 비워 두셔도 됩니다 — IT가 검토하며 정합니다.
                    </p>
                    <ul className="flex flex-col gap-0.5">
                      {REQUIREMENT_TYPES.map((t) => (
                        <li key={t}>
                          <b className="text-slate-700">{t}</b> · {TYPE_HINTS[t]}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="priority">우선순위</Label>
                  <LevelSelect
                    id="priority"
                    value={form.priority}
                    onChange={(v) => updateField('priority', v)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="category">카테고리</Label>
                  <Select
                    items={[
                      { value: 'none', label: '선택 안 함' },
                      ...categories.map((c) => ({ value: c.id, label: c.category_name })),
                    ]}
                    value={form.category}
                    onValueChange={(value) => updateField('category', value)}
                  >
                    <SelectTrigger id="category" className="h-11 w-full md:h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">선택 안 함</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.category_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="requestDate">요청일</Label>
                  <Input
                    id="requestDate"
                    type="date"
                    className="h-11 md:h-8"
                    value={form.requestDate}
                    onChange={(e) => updateField('requestDate', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="projectId">프로젝트</Label>
                  <Select
                    items={[
                      { value: 'none', label: '선택 안 함' },
                      ...projects.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                    value={form.projectId}
                    onValueChange={(value) => updateField('projectId', value)}
                  >
                    <SelectTrigger id="projectId" className="h-11 w-full md:h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">선택 안 함</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="isConfidential"
              checked={form.isConfidential}
              onCheckedChange={(checked) => updateField('isConfidential', Boolean(checked))}
            />
            <Label htmlFor="isConfidential">비공개 요구사항 (브랜드 관리자 이상만 조회 가능)</Label>
          </div>

          {/* 에러는 버튼 바로 위다. 폼 맨 위에 두면 모바일에서 폼을 다 내려가
              아래쪽 버튼을 눌렀을 때 메시지가 화면 밖에 뜬다 — 사용자 눈에는
              버튼을 눌렀는데 아무 일도 안 일어난 것으로 보인다.
              채널을 필수로 만들면서 이 경로가 새로 생겼다. 누른 사람의 눈은
              버튼 근처에 있으므로 데스크톱에서도 이쪽이 맞다. */}
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <DialogFooter className="flex-col items-stretch gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-end">
            {/* 무엇이 달라지는지 한 줄로 적어 둔다. 버튼 이름만 보고
                '임시저장'이 남에게 보이는지 아닌지 알 수 없다. */}
            <p className="mr-auto text-xs text-slate-500">
              검토 요청하면 IT 담당자에게 전달됩니다. 임시저장은 나에게만 보입니다.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              className="h-11 w-full md:h-9 md:w-auto"
              onClick={(e) => handleSubmit(e, false)}
            >
              {submitting ? '저장 중...' : '임시저장'}
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 w-full bg-indigo-600 hover:bg-indigo-700 md:h-9 md:w-auto"
            >
              {submitting ? '요청 중...' : '검토 요청'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
