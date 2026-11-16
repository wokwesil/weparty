import { redirect } from "next/navigation";
import { currentHostId } from "@/lib/session";
import { AuthForm } from "../AuthForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Host sign in" };

export default async function Login() {
  if (await currentHostId()) redirect("/host");
  return <AuthForm mode="login" />;
}
