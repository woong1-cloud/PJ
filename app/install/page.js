import { InstallGuide } from '@/components/install/InstallGuide';

// 폰에 앱으로 까는 방법.
//
// 페이지다. 팝업이 아니다 — QR 을 찍는 동안 열려 있어야 하고, 인쇄해서
// 나눠 줄 수도 있어야 한다.
//
// 로그인한 사람만 본다. 이 안내를 받을 사람은 이미 모아 계정이 있는
// 사람이고, PUBLIC_PATHS 를 늘리면 그만큼 열린 화면이 는다.
export default function InstallPage() {
  return <InstallGuide qr="/icons/install-qr.2030967c.png" />;
}
