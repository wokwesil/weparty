import { notFound, redirect } from "next/navigation";
import { isPlatformAdmin } from "@/lib/services/analytics";
import { currentHostId } from "@/lib/session";
import { AdminDashboard } from "./AdminDashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Owner dashboard", robots: { index: false, follow: false } };

/** Owner-only: who visits the website and who is on it right now. */
export default async function AdminPage() {
  const hostId = await currentHostId();
  if (!hostId) redirect("/host/login");
  // Anyone who isn't the owner just sees "page not found".
  if (!(await isPlatformAdmin(hostId))) notFound();
  return <AdminDashboard />;
}
