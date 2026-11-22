import { emailConfigured } from "@/lib/services/passwordReset";
import { ForgotForm } from "./ForgotForm";

export const metadata = { title: "Forgot password" };
export const dynamic = "force-dynamic";

export default function Forgot() {
  return <ForgotForm emailReady={emailConfigured()} />;
}
