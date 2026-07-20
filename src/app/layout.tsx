import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { History } from "lucide-react";
import Link from "next/link";
import "./globals.css";
import { LogoMark } from "@/components/logo-mark";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "라이엇 공식 API 데이터로 리그 오브 레전드 솔로랭크의 숨겨진 MMR을 추정합니다. 최근 경기 로비의 랭크를 역추적해 내 진짜 실력 점수를 확인해 보세요.";

export const metadata: Metadata = {
  metadataBase: new URL("https://mmr-lens.kro.kr"),
  title: {
    default: "MMR Lens — 숨겨진 MMR 판독기",
    template: "%s | MMR Lens",
  },
  description: DESCRIPTION,
  keywords: [
    "롤 MMR",
    "MMR 측정",
    "숨겨진 MMR",
    "롤 MMR 확인",
    "리그오브레전드 MMR",
    "솔로랭크 MMR",
    "MMR 조회",
  ],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "MMR Lens",
    title: "MMR Lens — 숨겨진 MMR 판독기",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {/* 배경 장식: 상단 블루 글로우 */}
          <div
            aria-hidden
            className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-105 overflow-hidden"
          >
            <div className="absolute left-1/2 -top-56 size-144 -translate-x-1/2 rounded-full bg-primary/12 blur-3xl dark:bg-primary/10" />
          </div>

          <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-md">
            <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
              <Link href="/" className="group flex items-center gap-2">
                <LogoMark className="size-7 shadow-sm transition-transform group-hover:scale-110" />
                <span className="font-semibold tracking-tight">
                  MMR <span className="text-primary">Lens</span>
                </span>
              </Link>
              <div className="flex items-center gap-1">
                <Link
                  href="/recent"
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <History className="size-4" />
                  최근 검색
                </Link>
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
            {children}
          </main>
          <footer className="border-t py-4 text-center text-xs text-muted-foreground">
            MMR Lens는 Riot Games의 공식 서비스가 아니며, 추정치는 참고용입니다.
          </footer>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
