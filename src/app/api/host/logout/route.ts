import { api, clearHostCookie } from "@/lib/session";
export const POST = api(async () => {
  await clearHostCookie();
  return { ok: true };
});
