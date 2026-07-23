"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeCheck,
  Bell,
  LayoutDashboard,
  LogOut,
  Users,
  Wrench,
} from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/summoners", label: "소환사", icon: Users },
  { href: "/admin/verified", label: "인증", icon: BadgeCheck },
  { href: "/admin/notifications", label: "알림", icon: Bell },
  { href: "/admin/maintenance", label: "점검", icon: Wrench },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* 사이드바 (모바일에선 가로 스크롤 탭) */}
      <aside className="lg:w-48 lg:shrink-0">
        <div className="mb-4 hidden items-center gap-2 lg:flex">
          <LogoMark className="size-8" />
          <span className="font-semibold tracking-tight">관리자</span>
        </div>
        <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:pb-0">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/admin" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="shrink-0 justify-start gap-2 px-3 text-muted-foreground lg:mt-2"
          >
            <LogOut className="size-4" />
            로그아웃
          </Button>
        </nav>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
