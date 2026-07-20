import { cookies } from "next/headers";
import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminLogin } from "@/components/admin-login";
import { ADMIN_COOKIE, isValidAdminSession } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "관리자",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const cookieStore = await cookies();
  const authed = await isValidAdminSession(
    cookieStore.get(ADMIN_COOKIE)?.value,
  );
  return authed ? <AdminDashboard /> : <AdminLogin />;
}
