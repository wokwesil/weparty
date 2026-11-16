"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/client";

export function HostHeaderActions() {
  const router = useRouter();
  return (
    <button
      className="btn btn-ghost px-3 py-1.5 text-xs"
      onClick={async () => {
        await apiFetch("/api/host/logout", { method: "POST" });
        router.replace("/host/login");
      }}
    >
      Sign out
    </button>
  );
}

export function NewEventForm({ orgs }: { orgs: { id: string; name: string }[] }) {
  const router = useRouter();
  const [f, setF] = useState({ name: "", venueName: "", startsAt: "", description: "", orgId: orgs[0]?.id ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { id } = await apiFetch<{ id: string }>("/api/host/events", {
        method: "POST",
        json: { ...f, startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null },
      });
      router.push(`/host/events/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass flex flex-col gap-3 rounded-3xl p-5">
      <h2 className="font-display text-lg font-bold">New event</h2>
      <input className="field" placeholder="Event name" value={f.name} onChange={set("name")} required maxLength={120} name="eventName" />
      <input className="field" placeholder="Venue (optional)" value={f.venueName} onChange={set("venueName")} maxLength={120} />
      <label className="text-xs text-muted">
        Date & time
        <input className="field mt-1" type="datetime-local" value={f.startsAt} onChange={set("startsAt")} />
      </label>
      <textarea className="field min-h-20" placeholder="Note for guests (optional)" value={f.description} onChange={set("description")} maxLength={1000} />
      {orgs.length > 1 && (
        <select className="field" value={f.orgId} onChange={set("orgId")} aria-label="Account">
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      )}
      {error && <p className="text-sm text-rose-300">{error}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create event + QR code"}</button>
    </form>
  );
}

export function TeamPanel({ orgs }: { orgs: { id: string; name: string; kind: string; plan: string; role: string }[] }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"dj" | "admin">("dj");
  const [orgId, setOrgId] = useState(orgs.find((o) => o.role !== "dj")?.id ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const canInvite = orgs.some((o) => o.role !== "dj");
  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await apiFetch(`/api/host/orgs/${orgId}/members`, { method: "POST", json: { email, role } });
      setMsg(`Added ${email} as ${role === "dj" ? "a DJ" : "an admin"}.`);
      setEmail("");
    } catch (err) {
      setMsg((err as Error).message);
    }
  };
  return (
    <div className="glass rounded-3xl p-5">
      <h2 className="text-xs font-bold tracking-[0.3em] text-muted uppercase">Accounts & team</h2>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {orgs.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold">{o.name}</span>
            <span className="shrink-0 text-xs text-muted">{o.kind} · {o.plan} plan · {o.role}</span>
          </li>
        ))}
      </ul>
      {canInvite && (
        <form onSubmit={invite} className="mt-4 flex flex-col gap-2">
          <p className="text-xs text-muted">Let a DJ or co-host run your events. They need their own WeParty host account first.</p>
          <input className="field py-2 text-sm" type="email" placeholder="Their email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div className="flex gap-2">
            {orgs.filter((o) => o.role !== "dj").length > 1 && (
              <select className="field py-2 text-sm" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                {orgs.filter((o) => o.role !== "dj").map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            )}
            <select className="field py-2 text-sm" value={role} onChange={(e) => setRole(e.target.value as "dj" | "admin")}>
              <option value="dj">DJ (run the queue)</option>
              <option value="admin">Admin (everything)</option>
            </select>
          </div>
          <button className="btn btn-ghost py-2 text-sm">Add to team</button>
          {msg && <p className="text-xs text-muted">{msg}</p>}
        </form>
      )}
    </div>
  );
}
