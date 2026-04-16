import { useMemo } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useCalls, useHealth, useTeam } from "@/hooks/use-calls";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from "recharts";

// ── Static mock review log entries ────────────────────────────────────
const REVIEW_LOG = [
  { icon: "mic",     iconColor: "#4ff5df", title: "Incoming Call #4812",    meta: "Node: Alpha-7 · 2m ago",                  fill: true },
  { icon: "verified",iconColor: "#5ff0dd", title: "Verification Success",   meta: "Internal Review · 15m ago",               fill: true },
  { icon: "warning", iconColor: "#ff716c", title: "Flagged Exception",      meta: "Manual Override Required · 1h ago",       fill: true },
  { icon: "mic",     iconColor: "#4ff5df", title: "Incoming Call #4810",    meta: "Node: Beta-3 · 2h ago",                   fill: true },
];

export default function DashboardPage() {
  const isAdmin    = useAuthStore((s) => s.isAtLeast)("admin");
  const { data: calls,  isLoading: callsLoading  } = useCalls();
  const { data: health, isLoading: healthLoading } = useHealth();
  const { data: team } = useTeam();
  const navigate = useNavigate();

  const pending          = calls?.filter((c) => c.eval.status === "pending").length   ?? 0;
  const completed        = calls?.filter((c) => c.eval.status === "completed").length ?? 0;
  const firstPendingId   = calls?.find((c) => c.eval.status === "pending")?.call.id;

  // Hourly call distribution for traffic chart
  const trafficData = useMemo(() => {
    const buckets: Record<number, number> = {};
    for (let h = 0; h < 24; h++) buckets[h] = 0;
    calls?.forEach(({ call }) => {
      const h = new Date(call.date).getHours();
      buckets[h] = (buckets[h] || 0) + 1;
    });
    return Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: h % 6 === 0 ? `${String(h).padStart(2, "0")}:00` : "",
      count: buckets[h] ?? 0,
    }));
  }, [calls]);

  const maxTraffic = Math.max(...trafficData.map((d) => d.count), 1);

  const envBreakdown = useMemo(() => {
    if (!calls || calls.length === 0) return [];
    const total = calls.length;
    const counts: Record<string, number> = {};
    calls.forEach(({ call }) => {
      const env = call.source_env || "unknown";
      counts[env] = (counts[env] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([env, n]) => ({ env: env.toUpperCase(), pct: Math.round((n / total) * 100), count: n }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 4);
  }, [calls]);

  const backendOnline = !healthLoading && health?.status === "ok";

  return (
    <div className="animate-in fade-in duration-500">

      {/* ── Hero bento row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6 mb-10">

        {/* Featured action card — 8 cols */}
        <div
          className="col-span-12 lg:col-span-8 rounded-3xl p-8 relative overflow-hidden group"
          style={{ background: "#1c1c1e" }}
        >
          {/* Aurora glow behind card */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(circle at 30% 50%, rgba(34,219,198,0.07) 0%, transparent 65%)",
              zIndex: 0,
            }}
          />
          {/* Abstract decorative right panel */}
          <div
            className="absolute right-0 top-0 w-2/5 h-full opacity-10 group-hover:opacity-20 transition-all duration-700 pointer-events-none"
            style={{
              background: "linear-gradient(135deg, transparent 0%, rgba(79,245,223,0.15) 50%, transparent 100%)",
              zIndex: 0,
            }}
          />
          <div className="relative z-10 flex flex-col h-full justify-between min-h-[220px]">
            <div>
              {/* Badge chip */}
              <span
                className="inline-block px-3 py-1 rounded-full text-[10px] tracking-widest uppercase font-bold mb-6"
                style={{ background: "#0b5345", color: "#a1e1cf" }}
              >
                {isAdmin ? "System Pulse" : "Reviewer Session"}
              </span>
              <h2
                className="text-4xl font-extrabold tracking-tight mb-4 max-w-lg leading-tight"
                style={{ color: "#ffffff" }}
              >
                {isAdmin ? (
                  <>Ready for the next{" "}<span style={{ color: "#4ff5df" }}>Operational Review?</span></>
                ) : (
                  <>Your calls are{" "}<span style={{ color: "#4ff5df" }}>waiting for review.</span></>
                )}
              </h2>
              <p className="text-base max-w-md leading-relaxed" style={{ color: "#adaaaa" }}>
                {isAdmin
                  ? `There are ${callsLoading ? "…" : pending} pending calls waiting for verification. All system nodes operating within optimal parameters.`
                  : `You have ${callsLoading ? "…" : pending} pending and ${callsLoading ? "…" : completed} completed calls in your queue.`
                }
              </p>
            </div>
            <div className="mt-8 flex items-center gap-4 flex-wrap">
              <button
                className="px-8 py-4 rounded-2xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #4ff5df, #22dbc6)",
                  color: "#00594f",
                  boxShadow: "0 8px 32px rgba(79,245,223,0.2)",
                }}
                onClick={() => firstPendingId ? navigate(`/eval/${firstPendingId}`) : navigate("/calls")}
              >
                Start Reviewing
              </button>
              <button
                className="px-8 py-4 rounded-2xl text-sm font-semibold transition-all hover:bg-white/10"
                style={{ background: "#2c2c2c", color: "#ffffff" }}
                onClick={() => navigate("/calls")}
              >
                View Queue
              </button>
            </div>
          </div>
        </div>

        {/* Side metrics — 4 cols, 2 rows stacked */}
        <div className="col-span-12 lg:col-span-4 grid grid-rows-2 gap-6">
          {/* Pending Calls */}
          <div
            className="rounded-3xl p-6 flex flex-col justify-between border"
            style={{ background: "#201f1f", borderColor: "rgba(255,255,255,0.05)" }}
          >
            <div className="flex justify-between items-start">
              <span
                className="material-symbols-outlined text-3xl"
                style={{ color: "#4ff5df", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
              >
                pending_actions
              </span>
              <span className="font-bold text-xs" style={{ color: "#ff716c" }}>
                {pending > 0 ? `+${pending} open` : "All clear"}
              </span>
            </div>
            <div>
              <p
                className="text-[11px] uppercase tracking-widest font-bold mb-1"
                style={{ color: "#adaaaa" }}
              >
                Pending Calls
              </p>
              {callsLoading ? (
                <Skeleton className="h-14 w-24 mt-1" style={{ background: "rgba(255,255,255,0.05)" }} />
              ) : (
                <h3 className="text-5xl font-extrabold tracking-tighter" style={{ color: "#ffffff" }}>
                  {pending}
                </h3>
              )}
            </div>
          </div>

          {/* Completed Today */}
          <div
            className="rounded-3xl p-6 flex flex-col justify-between border"
            style={{ background: "#201f1f", borderColor: "rgba(255,255,255,0.05)" }}
          >
            <div className="flex justify-between items-start">
              <span
                className="material-symbols-outlined text-3xl"
                style={{ color: "#4ff5df", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
              >
                task_alt
              </span>
              <span className="font-bold text-xs" style={{ color: "#4ff5df" }}>
                {completed > 0 ? `${Math.round((completed / Math.max(1, completed + pending)) * 100)}%` : "—"}
              </span>
            </div>
            <div>
              <p
                className="text-[11px] uppercase tracking-widest font-bold mb-1"
                style={{ color: "#adaaaa" }}
              >
                Completed Today
              </p>
              {callsLoading ? (
                <Skeleton className="h-14 w-24 mt-1" style={{ background: "rgba(255,255,255,0.05)" }} />
              ) : (
                <h3 className="text-5xl font-extrabold tracking-tighter" style={{ color: "#ffffff" }}>
                  {completed.toLocaleString()}
                </h3>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── System Status ─────────────────────────────────────────────── */}
      <div className="mb-10 flex items-center gap-3">
        <h4 className="text-xl font-bold tracking-tight" style={{ color: "#ffffff" }}>
          System Status
        </h4>
        {healthLoading ? (
          <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "#adaaaa" }}>Checking…</span>
        ) : (
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: backendOnline ? "#4ff5df" : "#ff716c" }}
            />
            <span
              className="text-[10px] uppercase tracking-widest font-bold"
              style={{ color: backendOnline ? "#4ff5df" : "#ff716c" }}
            >
              {backendOnline ? "Backend Online" : "Backend Unreachable"}
            </span>
          </div>
        )}
      </div>

      {/* ── Bottom asymmetric row ─────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6">

        {/* System Performance / Traffic — 7 cols */}
        <div className="col-span-12 lg:col-span-7">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-xl font-bold tracking-tight" style={{ color: "#ffffff" }}>
              System Performance
            </h4>
            <button
              className="text-[10px] uppercase tracking-widest font-bold hover:underline transition-colors"
              style={{ color: "#4ff5df" }}
            >
              Export
            </button>
          </div>
          <div
            className="rounded-3xl p-8 border flex flex-col justify-end relative overflow-hidden min-h-[300px]"
            style={{ background: "#1c1c1e", borderColor: "rgba(255,255,255,0.05)" }}
          >
            {/* Subtle grid background texture */}
            <div
              className="absolute inset-0 pointer-events-none opacity-30"
              style={{
                backgroundImage: "linear-gradient(rgba(79,245,223,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(79,245,223,0.03) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            <div className="relative z-10">
              {/* Peak stats row */}
              <div className="flex gap-10 mb-6">
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: "#adaaaa" }}>
                    {isAdmin ? "Total Calls" : "My Total Calls"}
                  </p>
                  <p className="text-3xl font-bold" style={{ color: "#ffffff" }}>
                    {callsLoading ? "…" : (calls?.length ?? 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: "#adaaaa" }}>
                    Completion Rate
                  </p>
                  <p className="text-3xl font-bold" style={{ color: "#4ff5df" }}>
                    {callsLoading || !calls?.length
                      ? "—"
                      : `${Math.round((completed / Math.max(1, completed + pending)) * 100)}%`
                    }
                  </p>
                </div>
                {isAdmin && envBreakdown.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: "#adaaaa" }}>
                      Top Env
                    </p>
                    <p className="text-3xl font-bold" style={{ color: "#ffffff" }}>
                      {envBreakdown[0]?.env ?? "—"}
                    </p>
                  </div>
                )}
              </div>

              {/* Traffic bar chart */}
              {callsLoading ? (
                <div className="h-36 flex items-end gap-1">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm animate-pulse"
                      style={{
                        height: `${20 + Math.random() * 80}%`,
                        background: "rgba(79,245,223,0.08)",
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trafficData} barCategoryGap="20%">
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10, fontWeight: 700, fontFamily: "Inter" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        cursor={false}
                        content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div
                              className="border rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest"
                              style={{ background: "#201f1f", borderColor: "rgba(255,255,255,0.1)", color: "#4ff5df" }}
                            >
                              {payload[0].payload.hour}:00 · {payload[0].value} calls
                            </div>
                          ) : null
                        }
                      />
                      <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                        {trafficData.map((entry, i) => {
                          const intensity = entry.count / maxTraffic;
                          const opacity   = 0.12 + intensity * 0.88;
                          return <Cell key={i} fill={`rgba(79,245,223,${opacity})`} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Review Log — 5 cols */}
        <div className="col-span-12 lg:col-span-5">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-xl font-bold tracking-tight" style={{ color: "#ffffff" }}>
              {isAdmin ? "Review Log" : "My Recent Calls"}
            </h4>
            <button
              className="text-[10px] uppercase tracking-widest font-bold hover:underline transition-colors"
              style={{ color: "#4ff5df" }}
              onClick={() => navigate("/calls")}
            >
              View All
            </button>
          </div>

          {/* Recent calls list if available, otherwise mock log */}
          <div className="space-y-3">
            {calls && calls.length > 0
              ? calls.slice(0, 4).map(({ call, eval: ev }) => (
                  <ReviewLogItem
                    key={call.id}
                    icon={ev.status === "completed" ? "verified" : ev.status === "pending" ? "pending_actions" : "mic"}
                    iconColor={ev.status === "completed" ? "#4ff5df" : ev.status === "pending" ? "#afefdd" : "#ff716c"}
                    title={`Call #${call.id.slice(-6).toUpperCase()}`}
                    meta={`${call.source_env ?? "unknown"} · ${ev.status}`}
                    onClick={() => navigate(`/eval/${call.id}`)}
                  />
                ))
              : REVIEW_LOG.map((item, i) => (
                  <ReviewLogItem
                    key={i}
                    icon={item.icon}
                    iconColor={item.iconColor}
                    title={item.title}
                    meta={item.meta}
                  />
                ))
            }
          </div>

          {/* Team progress (reviewer view) */}
          {!isAdmin && team && team.length > 0 && (
            <div
              className="mt-6 rounded-2xl p-6 border"
              style={{ background: "#1c1c1e", borderColor: "rgba(255,255,255,0.05)" }}
            >
              <p className="text-[10px] uppercase tracking-widest font-bold mb-4" style={{ color: "#adaaaa" }}>
                Team Progress
              </p>
              <div className="space-y-4">
                {(team ?? []).slice(0, 3).map((m) => (
                  <div key={m.id} className="flex items-center gap-4">
                    <div
                      className="w-20 text-[10px] font-bold uppercase tracking-widest truncate"
                      style={{ color: "rgba(255,255,255,0.3)" }}
                    >
                      {m.name.split(" ")[0]}
                    </div>
                    <div
                      className="flex-1 h-1.5 rounded-full overflow-hidden"
                      style={{ background: "rgba(0,0,0,0.4)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${m.completion_pct}%`, background: "rgba(79,245,223,0.6)" }}
                      />
                    </div>
                    <div
                      className="w-10 text-right text-xs font-bold"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      {m.completion_pct}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  InfraCard                                                           */
/* ──────────────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────────────── */
/*  ReviewLogItem                                                       */
/* ──────────────────────────────────────────────────────────────────── */

function ReviewLogItem({
  icon,
  iconColor,
  title,
  meta,
  onClick,
}: {
  icon: string;
  iconColor: string;
  title: string;
  meta: string;
  onClick?: () => void;
}) {
  return (
    <div
      className="p-4 rounded-2xl border flex items-center justify-between group cursor-pointer transition-all duration-200"
      style={{ background: "#201f1f", borderColor: "rgba(255,255,255,0.05)" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#2c2c2c"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#201f1f"; }}
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "#000000" }}
        >
          <span
            className="material-symbols-outlined text-sm"
            style={{
              color: iconColor,
              fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24",
            }}
          >
            {icon}
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "#ffffff" }}>{title}</p>
          <p className="text-[10px] font-medium" style={{ color: "#adaaaa" }}>{meta}</p>
        </div>
      </div>
      <span
        className="material-symbols-outlined transition-colors duration-200"
        style={{ color: "#adaaaa", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
      >
        chevron_right
      </span>
    </div>
  );
}
