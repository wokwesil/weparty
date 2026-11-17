import "server-only";
import { sql } from "../db";
import { flags } from "../flags";
import { effectivePlan } from "../payments/config";
import { stripeConfigured } from "../payments/stripe";

export { getHostAccount } from "./hosts";

/** Events a host can buy an Event Pass for (not ended, in an org they run). */
export async function listHostEventsForBilling(hostId: string, orgId: string) {
  const rows = await sql<{ id: string; name: string }[]>`
    select e.id, e.name from events e
    join org_members m on m.org_id = e.org_id and m.host_id = ${hostId} and m.role <> 'dj'
    where e.org_id = ${orgId} and e.status <> 'ended' and not e.event_pass
    order by coalesce(e.starts_at, e.created_at) desc limit 50`;
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

export type OrgMoney = {
  orgId: string;
  orgName: string;
  planName: string;
  planStatus: string | null;
  hasBilling: boolean;
  payoutsStarted: boolean;
  payoutsEnabled: boolean;
};

/** Money status for the host dashboard. Null when neither payments nor plans are switched on. */
export async function getOrgMoney(hostId: string): Promise<{ plans: boolean; payments: boolean; orgs: OrgMoney[] } | null> {
  if (!flags.plans && !flags.payments) return null;
  const rows = await sql<
    { id: string; name: string; plan: string; plan_status: string | null; billing_customer_id: string | null; stripe_account_id: string | null; payouts_enabled: boolean }[]
  >`
    select o.id, o.name, o.plan, o.plan_status, o.billing_customer_id, o.stripe_account_id, o.payouts_enabled
    from org_members m join organizations o on o.id = m.org_id
    where m.host_id = ${hostId} and m.role <> 'dj' order by m.created_at`;
  return {
    plans: flags.plans,
    payments: flags.payments && stripeConfigured(),
    orgs: rows.map((o) => ({
      orgId: o.id,
      orgName: o.name,
      planName: effectivePlan(o.plan).name,
      planStatus: o.plan_status,
      hasBilling: Boolean(o.billing_customer_id),
      payoutsStarted: Boolean(o.stripe_account_id),
      payoutsEnabled: o.payouts_enabled,
    })),
  };
}
