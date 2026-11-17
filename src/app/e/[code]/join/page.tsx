import { redirect } from "next/navigation";

type Props = { params: Promise<{ code: string }> };

/** Old link: joining now happens on the party's first screen. */
export default async function JoinPage({ params }: Props) {
  redirect(`/e/${encodeURIComponent((await params).code)}`);
}
