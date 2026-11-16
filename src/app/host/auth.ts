import "server-only";
import { redirect } from "next/navigation";
import { getHostAccount } from "@/lib/services/hosts";
import { currentHostId } from "@/lib/session";

/** For host pages: returns the signed-in host or sends them to sign in. */
export async function requireHostPage() {
  const id = await currentHostId();
  const account = id ? await getHostAccount(id) : null;
  if (!account) redirect("/host/login");
  return account;
}
