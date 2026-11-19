"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Backdrop, Wordmark } from "@/components/Brand";
import type { Dashboard, Person } from "@/lib/services/analytics";

const REFRESH_MS = 5_000;

function pageLabel(path: string | null) {
  if (!path) return "—";
  if (path === "/") return "Home page";
  if (/^\/e\/[^/]+\/?$/.test(path)) return "Party welcome";
  if (/^\/e\/[^/]+\/join/.test(path)) return "Joining a party";
  if (/^\/e\/[^/]+\/pick/.test(path)) return "Picking songs";
  if (/^\/e\/[^/]+\/party/.test(path)) return "Live queue";
  if (/^\/e\/[^/]+\/replay/.test(path)) return "Party replay";
  if (/^\/host\/events\/[^/]+\/poster/.test(path)) return "Host: QR poster";
  if (/^\/host\/events\/[^/]+\/insights/.test(path)) return "Host: insights";
  if (/^\/host\/events\//.test(path)) return "Host: control room";
  if (path === "/host") return "Host dashboard";
  if (path === "/support") return "Help page";
  if (path === "/privacy") return "Privacy page";
  if (path.startsWith("/host/login")) return "Host sign in";
  if (path.startsWith("/host/signup")) return "Host sign up";
  return path;
}

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return s < 10 ? "just now" : `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

function duration(iso: string, now: number) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return "under a minute";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function AdminDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(`/api/admin/stats?tz=${encodeURIComponent(tz)}`, { cache: "no-store", credentials: "same-origin" });
      if (res.status === 401 || res.status === 404) {
        window.location.href = "/host/login";
        return;
      }
      if (!res.ok) throw new Error();
      setData(await res.json());
      setError(null);
    } catch {
      setError("Couldn't refresh. Retrying…");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    const c = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(t);
      clearInterval(c);
    };
  }, [load]);

  return (
    <main className="relative mx-auto min-h-dvh max-w-6xl px-4 pb-16 pt-4 sm:px-6">
      <Backdrop />
      <header className="flex flex-wrap items-center gap-3 py-3">
        <Link href="/" className="tap"><Wordmark size="sm" /></Link>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">Owner</span>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted">
          <span aria-live="polite">{error ?? (data ? `Updated ${ago(data.generatedAt, now)}` : "Loading…")}</span>
          <Link href="/host" className="btn btn-ghost min-h-11 px-3 py-1.5 text-xs">Host dashboard</Link>
        </div>
      </header>

      <div className="mt-4">
        <h1 className="font-display text-3xl font-black">Site dashboard</h1>
        <p className="mt-1 text-muted">Who is visiting We Party and who is on it right now. Updates every few seconds.</p>
      </div>

      {!data ? (
        <p className="glass mt-8 rounded-3xl p-8 text-center text-muted">{error ?? "Loading the numbers…"}</p>
      ) : (
        <Body data={data} now={now} />
      )}
    </main>
  );
}

function Body({ data, now }: { data: Dashboard; now: number }) {
  const t = data.totals;
  return (
    <>
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Key numbers">
        <Kpi live label="On the site now" value={t.live} />
        <Kpi label="Visitors today" value={t.visitorsToday} sub={`${fmt(t.newToday)} new`} />
        <Kpi label="Visitors, 7 days" value={t.visitors7d} sub={`${fmt(t.returning7d)} came back`} />
        <Kpi label="Visitors, 30 days" value={t.visitors30d} />
        <Kpi label="Page views today" value={t.viewsToday} sub={`${fmt(t.views7d)} this week`} />
        <Kpi label="All-time visitors" value={t.visitorsAll} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <LiveList people={data.live} now={now} />
        <Parties parties={data.parties} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Visitors per day" note="Last 30 days">
          <Bars
            items={data.daily.map((d) => ({
              key: d.day,
              value: d.visitors,
              label: new Date(`${d.day}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              detail: `${fmt(d.visitors)} visitors · ${fmt(d.views)} page views`,
            }))}
            tickEvery={7}
          />
        </Panel>
        <Panel title="Visitors per hour" note="Last 24 hours">
          <Bars
            items={data.hourly.map((h, i) => ({
              key: `${i}-${h.hour}`,
              value: h.visitors,
              label: hourLabel(h.hour),
              detail: `${fmt(h.visitors)} visitors`,
            }))}
            tickEvery={6}
          />
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Panel title="Top pages" note="7 days"><Ranked rows={data.topPages} /></Panel>
        <Panel title="Where they came from" note="30 days"><Ranked rows={data.referrers} /></Panel>
        <Panel title="Locations" note="30 days"><Ranked rows={data.places} /></Panel>
        <Panel title="Devices" note="30 days"><Ranked rows={data.devices} /></Panel>
      </section>

      <section className="mt-6">
        <Recent people={data.recent} now={now} />
      </section>

      <section className="mt-6 glass rounded-3xl p-5">
        <h2 className="text-xs font-bold tracking-[0.3em] text-muted uppercase">We Party all-time</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            [data.platform.hosts, "host accounts"],
            [data.platform.events, "parties created"],
            [data.platform.guests, "guests joined"],
            [data.platform.songs, "songs requested"],
          ].map(([v, l]) => (
            <div key={String(l)}>
              <p className="font-display text-2xl font-bold">{fmt(Number(v))}</p>
              <p className="text-xs text-muted">{l}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">
          Counts people using the website and the app. Search engines and link previews are left out. Times are in {data.timeZone.replace(/_/g, " ")}.
          Someone counts as &quot;on the site now&quot; if their screen checked in during the last {data.liveSeconds} seconds.
        </p>
      </section>
    </>
  );
}

function hourLabel(h: string) {
  const n = Number(h);
  return n === 0 ? "12am" : n < 12 ? `${n}am` : n === 12 ? "12pm" : `${n - 12}pm`;
}

function Kpi({ label, value, sub, live }: { label: string; value: number; sub?: string; live?: boolean }) {
  return (
    <div className={`glass rounded-3xl p-4 ${live ? "ring-1 ring-lime/40" : ""}`}>
      <p className="flex items-center gap-2 text-xs text-muted">
        {live && (
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-lime" />
          </span>
        )}
        {label}
      </p>
      <p className={`mt-1 font-display text-3xl font-black ${live ? "text-lime" : ""}`}>{fmt(value)}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="glass min-w-0 rounded-3xl p-5">
      <div className="flex items-baseline gap-2">
        <h2 className="text-xs font-bold tracking-[0.3em] text-muted uppercase">{title}</h2>
        {note && <span className="ml-auto text-xs text-muted">{note}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function KindBadge({ kind }: { kind: Person["kind"] }) {
  const cls = kind === "host" ? "bg-violet/25 text-violet-200" : kind === "guest" ? "bg-pink/20 text-pink-200" : "bg-white/10 text-muted";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${cls}`}>{kind}</span>;
}

function Initial({ name, kind }: { name: string; kind: Person["kind"] }) {
  const bg = kind === "host" ? "bg-violet/40" : kind === "guest" ? "bg-pink/40" : "bg-white/10";
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${bg}`} aria-hidden>
      {name.replace(/^Visitor /, "").slice(0, 1).toUpperCase()}
    </span>
  );
}

function LiveList({ people, now }: { people: Person[]; now: number }) {
  return (
    <Panel title="Live right now" note={`${fmt(people.length)} online`}>
      {people.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nobody is on the site this minute. This list fills in as people open it.</p>
      ) : (
        <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">
          {people.map((p) => (
            <li key={p.visitorId} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
              <Initial name={p.who} kind={p.kind} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold">{p.who}</span>
                  <KindBadge kind={p.kind} />
                  {p.instagram && (
                    <a href={`https://instagram.com/${p.instagram}`} target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-white">
                      @{p.instagram}
                    </a>
                  )}
                </p>
                <p className="truncate text-xs text-muted">
                  {[pageLabel(p.path), p.party, p.place, [p.device, p.browser].filter(Boolean).join(" · ")].filter(Boolean).join("  ·  ")}
                </p>
              </div>
              <span className="shrink-0 text-right text-xs text-muted">
                on for
                <br />
                <span className="font-semibold text-white">{duration(p.sessionStartedAt, now)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Parties({ parties }: { parties: Dashboard["parties"] }) {
  return (
    <Panel title="Parties" note="Live and recent">
      {parties.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No live parties right now.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {parties.map((p) => (
            <li key={p.code} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="text-xs text-muted">
                  /{p.code} · {p.status === "ended" ? "ended" : "live"} · {fmt(p.joinedToday)} joined today
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center text-xs text-muted">
                <div>
                  <p className={`font-display text-lg font-bold ${p.online ? "text-lime" : "text-white"}`}>{fmt(p.online)}</p>
                  online
                </div>
                <div>
                  <p className="font-display text-lg font-bold text-white">{fmt(p.guests)}</p>
                  guests
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Bars({ items, tickEvery }: { items: { key: string; value: number; label: string; detail: string }[]; tickEvery: number }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0);
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover !== null ? items[hover] : null;
  return (
    <div>
      <p className="h-5 text-sm">
        {shown ? (
          <>
            <span className="font-semibold">{shown.label}</span> <span className="text-muted">· {shown.detail}</span>
          </>
        ) : (
          <span className="text-muted">Peak {fmt(max === 1 && total === 0 ? 0 : max)} · tap a bar for details</span>
        )}
      </p>
      <div className="mt-3 flex h-40 items-end gap-[3px]" role="img" aria-label={items.map((i) => `${i.label}: ${i.value}`).join(", ")}>
        {items.map((it, i) => (
          <button
            key={it.key}
            type="button"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            onClick={() => setHover(i)}
            className="group flex h-full min-w-0 flex-1 items-end"
            aria-label={`${it.label}: ${it.detail}`}
          >
            <span
              className={`block w-full rounded-t-[4px] transition-colors ${hover === i ? "bg-pink" : it.value ? "bg-violet" : "bg-white/10"}`}
              style={{ height: `${it.value ? Math.max(4, (it.value / max) * 100) : 2}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-[3px] text-[10px] text-muted">
        {items.map((it, i) => (
          <span key={it.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
            {i % tickEvery === 0 ? it.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function Ranked({ rows }: { rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (rows.length === 0) return <p className="text-sm text-muted">No data yet.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.label} className="relative overflow-hidden rounded-xl bg-white/5 px-3 py-2 text-sm">
          <span className="absolute inset-y-0 left-0 bg-violet/30" style={{ width: `${(r.count / max) * 100}%` }} aria-hidden />
          <span className="relative flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate">{r.label}</span>
            <span className="font-semibold tabular-nums">{fmt(r.count)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Recent({ people, now }: { people: Person[]; now: number }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return people;
    return people.filter((p) => [p.who, p.instagram, p.place, p.party, p.referrer].some((v) => v?.toLowerCase().includes(s)));
  }, [people, q]);
  return (
    <Panel title="Recent visitors" note="Latest 60">
      <input
        className="field mb-3 w-full sm:max-w-xs"
        placeholder="Search name, place, party…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search recent visitors"
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-2 pr-3 font-semibold">Who</th>
              <th className="py-2 pr-3 font-semibold">Last page</th>
              <th className="py-2 pr-3 font-semibold">Location</th>
              <th className="py-2 pr-3 font-semibold">Device</th>
              <th className="py-2 pr-3 font-semibold">Came from</th>
              <th className="py-2 pr-3 text-right font-semibold">Visits</th>
              <th className="py-2 text-right font-semibold">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.visitorId} className="border-t border-white/5">
                <td className="py-2 pr-3">
                  <span className="flex items-center gap-2">
                    {p.live && <span className="h-2 w-2 shrink-0 rounded-full bg-lime" title="On the site now" />}
                    <span className="truncate font-semibold">{p.who}</span>
                    <KindBadge kind={p.kind} />
                  </span>
                </td>
                <td className="py-2 pr-3 text-muted">{[pageLabel(p.path), p.party].filter(Boolean).join(" · ")}</td>
                <td className="py-2 pr-3 text-muted">{p.place ?? "—"}</td>
                <td className="py-2 pr-3 text-muted">{[p.device, p.browser].filter(Boolean).join(" · ") || "—"}</td>
                <td className="py-2 pr-3 text-muted">{p.referrer ?? "Direct / QR"}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{fmt(p.visits)}</td>
                <td className="py-2 text-right text-muted">{p.live ? <span className="text-lime">now</span> : ago(p.lastSeenAt, now)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="py-4 text-center text-sm text-muted">No visitors match.</p>}
      </div>
    </Panel>
  );
}
