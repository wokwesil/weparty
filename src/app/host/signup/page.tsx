import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { currentHostId } from "@/lib/session";
import { AuthForm } from "../AuthForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create host account" };

export default async function Signup() {
  if (await currentHostId()) redirect("/host");
  return <AuthForm mode="signup" needsInvite={Boolean(env.hostSignupCode)} />;
}
