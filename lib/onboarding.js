import { canProcess } from './tiers';

// 첫 로그인 안내에 띄울 내용.
//
// 등급에 따라 다른 것을 보여준다. 4차 요청자에게 "담당자를 지정하세요" 는
// 할 수 없는 일이고, 3차 이상에게 "요청을 올리는 법" 은 이미 아는 일이다.
// 못 하는 기능을 설명하면 그 사람은 안내 전체를 자기 것이 아니라고 판단한다.
//
// 세 장으로 묶는 이유: 네 장을 넘어가면 마지막 장은 아무도 안 읽는다.
// 그래서 각 등급이 처음에 꼭 알아야 할 것만 세 개로 추린다.

const REQUESTER_SLIDES = [
  {
    key: 'what',
    title: '요청을 한곳에 모읍니다',
    body: '메일과 메신저로 흩어지던 요청을 여기에 올리면, 어디까지 진행됐는지 언제든 볼 수 있습니다. 다시 물어볼 필요가 없습니다.',
  },
  {
    // 이 한 장이 이 기능을 만든 이유다. 실제로 열 건 중 세 건이 임시저장인 채로
    // 며칠씩 남아 있었다 — 올린 사람은 접수된 줄 알고 IT 는 존재를 몰랐다.
    key: 'submit',
    title: '"검토 요청"을 눌러야 전달됩니다',
    body: '임시저장은 나에게만 보입니다. IT 담당자에게 가려면 등록 창 오른쪽 아래의 "검토 요청"을 눌러야 합니다.',
  },
  {
    key: 'status',
    title: '상태가 지금 누구 차례인지 알려줍니다',
    body: '검토대기 → 검토중 → 개발중 → QA중 → 승인대기 → 완료 순으로 흘러갑니다. 자세한 뜻은 계정 메뉴의 도움말에 있습니다.',
  },
];

const PROCESSOR_SLIDES = [
  {
    key: 'inbox',
    title: '브랜드 요청이 여기 모입니다',
    body: '"검토대기"가 아직 아무도 손대지 않은 건입니다. 목록에서 상태로 걸러 보면 새로 들어온 것만 볼 수 있습니다.',
  },
  {
    key: 'start',
    title: '착수할 때 담당자와 예상일을 정합니다',
    body: '검토대기를 검토중으로 옮기면 창이 뜹니다. 여기서 정하지 않으면 요청한 사람은 언제 되는지 영영 알 수 없습니다.',
  },
  {
    key: 'approve',
    title: '완료는 승인을 거칩니다',
    body: '담당자 본인은 승인할 수 없습니다. 브랜드나 본부의 다른 분이 확인해야 완료로 넘어갑니다.',
  },
];

export function onboardingSlides(identity) {
  return canProcess(identity) ? PROCESSOR_SLIDES : REQUESTER_SLIDES;
}

// 안내를 띄울지. 아직 안 본 사람에게만 띄운다.
//
// mustChangePassword 인 동안에는 띄우지 않는다. 그 사람은 비밀번호 변경
// 화면에 묶여 있어서 설명을 읽어도 시험해 볼 화면이 없고, 창 두 개가 겹친다.
export function shouldShowOnboarding({ onboardedAt, mustChangePassword } = {}) {
  if (mustChangePassword) return false;
  return !onboardedAt;
}
