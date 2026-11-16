import "server-only";
import { sql } from "../db";
import { env } from "../env";
import { badRequest, forbidden, unauthorized } from "../errors";
import { hashPassword, verifyPassword } from "../security";

export type HostAccount = {
  id: string;
  email: string;
  displayName: string;
  orgs: { id: string; name: string; kind: string; plan: string; role: "owner" | "admin" | "dj" }[];
};

export async function signupHost(input: {
  email: string;
  password: string;
  displayName: string;
  orgName?: string;
  orgKind?: string;
  inviteCode?: string;
}) {
  if (env.hostSignupCode && input.inviteCode !== env.hostSignupCode) {
    throw forbidden("That host invite code isn't right.");
  }
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest("Please enter a valid email.");
  if (input.password.length < 8) throw badRequest("Password must be at least 8 characters.");
  const existing = await sql`select 1 from hosts where lower(email) = ${email}`;
  if (existing.length) throw badRequest("An account with that email already exists. Try signing in.");
  const hash = await hashPassword(input.password);
  const kind = ["host", "venue", "dj", "agency", "college"].includes(input.orgKind ?? "") ? input.orgKind! : "host";
  return sql.begin(async (tx) => {
    const [host] = await tx<{ id: string }[]>`
      insert into hosts (email, password_hash, display_name)
      values (${email}, ${hash}, ${input.displayName.trim().slice(0, 80) || "Host"})
      returning id`;
    const [org] = await tx<{ id: string }[]>`
      insert into organizations (name, kind)
      values (${(input.orgName?.trim() || `${input.displayName.trim()}'s parties`).slice(0, 120)}, ${kind})
      returning id`;
    await tx`insert into org_members (org_id, host_id, role) values (${org.id}, ${host.id}, 'owner')`;
    return host.id;
  });
}

const DUMMY_HASH = "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==";

export async function loginHost(emailRaw: string, password: string) {
  const email = emailRaw.trim().toLowerCase();
  const [row] = await sql<{ id: string; password_hash: string }[]>`
    select id, password_hash from hosts where lower(email) = ${email}`;
  // Always run a hash comparison so response time doesn't reveal which emails exist.
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) throw unauthorized("Email or password is incorrect.");
  await sql`update hosts set last_login_at = now() where id = ${row.id}`;
  return row.id;
}

export async function getHostAccount(hostId: string): Promise<HostAccount | null> {
  const [h] = await sql<{ id: string; email: string; display_name: string }[]>`
    select id, email, display_name from hosts where id = ${hostId}`;
  if (!h) return null;
  const orgs = await sql<HostAccount["orgs"]>`
    select o.id, o.name, o.kind, o.plan, m.role
    from org_members m join organizations o on o.id = m.org_id
    where m.host_id = ${hostId} order by m.created_at`;
  return { id: h.id, email: h.email, displayName: h.display_name, orgs: [...orgs] };
}

/** Returns the host's role for an event, or throws if they have no access. */
export async function requireEventRole(hostId: string, eventId: string, need: "dj" | "admin" = "dj") {
  const [row] = await sql<{ role: "owner" | "admin" | "dj" }[]>`
    select m.role from events e join org_members m on m.org_id = e.org_id
    where e.id = ${eventId} and m.host_id = ${hostId}`;
  if (!row) throw forbidden("You don't manage this event.");
  if (need === "admin" && row.role === "dj") throw forbidden("Only the event owner or an admin can do that.");
  return row.role;
}

export async function requireOrgRole(hostId: string, orgId: string) {
  const [row] = await sql<{ role: string }[]>`
    select role from org_members where org_id = ${orgId} and host_id = ${hostId}`;
  if (!row || row.role === "dj") throw forbidden("You can't create events for this account.");
  return row.role;
}

/** Adds another host (e.g. a DJ) to an organization. They must already have a WeParty host account. */
export async function addOrgMember(actorId: string, orgId: string, email: string, role: "admin" | "dj") {
  await requireOrgRole(actorId, orgId);
  const [h] = await sql<{ id: string }[]>`select id from hosts where lower(email) = ${email.trim().toLowerCase()}`;
  if (!h) throw badRequest("No host account uses that email yet. Ask them to sign up first.");
  await sql`insert into org_members (org_id, host_id, role) values (${orgId}, ${h.id}, ${role})
            on conflict (org_id, host_id) do update set role = excluded.role
            where org_members.role <> 'owner'`;
}
