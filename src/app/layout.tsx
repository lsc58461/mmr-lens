import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
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

export const metadata: Metadata = {
  title: "MMR Lens — 숨겨진 MMR 판독기",
  description:
    "라이엇 공식 API 데이터로 롤 솔로랭크의 숨겨진 MMR을 추정해 보여주는 사이트",
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
          <header className="border-b">
            <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4">
              <Link href="/" className="font-semibold tracking-tight">
                MMR <span className="text-primary">Lens</span>
              </Link>
              <ThemeToggle />
            </div>
          </header>
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
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
