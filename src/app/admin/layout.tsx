import { cookies } from "next/headers";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminLogin } from "@/components/admin-login";
import { ADMIN_COOKIE, isValidAdminSession } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "관리자",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const authed = await isValidAdminSession(cookieStore.get(ADMIN_COOKIE)?.value);
  if (!authed) return <AdminLogin />;
  return <AdminShell>{children}</AdminShell>;
}
