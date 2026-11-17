import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { handleStripeEvent, verifyWebhook } from "@/lib/services/payments";

export const dynamic = "force-dynamic";

/** Stripe calls this when a payment, subscription or payout account changes. */
export async function POST(req: Request) {
  const body = await req.text();
  try {
    const evt = verifyWebhook(body, req.headers.get("stripe-signature"));
    const result = await handleStripeEvent(evt);
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[stripe webhook]", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
