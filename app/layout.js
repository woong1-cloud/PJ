import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RegisterServiceWorker from '@/components/RegisterServiceWorker';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: '모아 MOA',
  description: '요구사항과 프로젝트를 한곳에 모읍니다.',
  manifest: '/manifest.json',
  // iOS 는 설치 프롬프트가 없다. 사용자가 공유 → 홈 화면에 추가를 직접
  // 해야 하고, apple-touch-icon 이 없으면 화면을 찍어서 아이콘으로 쓴다.
  appleWebApp: { capable: true, title: '모아', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};

// themeColor 를 metadata 에 두면 Next 15 부터 빌드 경고가 난다.
export const viewport = { themeColor: '#4f46e5' };

export default function RootLayout({ children }) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
