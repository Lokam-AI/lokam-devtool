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

const FF = '"cv01", "ss03"' as const;

const REVIEW_LOG = [
  { icon: "mic",      iconColor: "#7170ff", title: "Incoming Call #4812",  meta: "Node: Alpha-7 · 2m ago"            },
  { icon: "verified", iconColor: "#10b981", title: "Verification Success", meta: "Internal Review · 15m ago"         },
  { icon: "warning",  iconColor: "#ff716c", title: "Flagged Exception",    meta: "Manual Override Required · 1h ago" },
  { icon: "mic",      iconColor: "#7170ff", title: "Incoming Call #4810",  meta: "Node: Beta-3 · 2h ago"             },
];

export default function DashboardPage() {
  const isAdmin    = useAuthStore((s) => s.isAtLeast)("admin");
  const { data: calls,  isLoading: callsLoading, isError: callsError  } = useCalls();
  const { data: health, isLoading: healthLoading } = useHealth();
  const { data: team } = useTeam();
  const navigate = useNavigate();

  const pending         = calls?.filter((c) => c.eval.status === "pending").length   ?? 0;
  const completed       = calls?.filter((c) => c.eval.status === "completed").length ?? 0;
  const firstPendingId  = calls?.find((c) => c.eval.status === "pending")?.call.id;

  const trafficData = useMemo(() => {
    const buckets: Record<number, number> = {};
    for (let h = 0; h < 24; h++) buckets[h] = 0;
    calls?.forEach(({ call }) => {
      const h = new Date(`${call.date}T12:00:00`).getHours();
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

  if (callsError) {
    return (
      <div className="flex items-center justify-center h-64">
        <p
          className="text-xs uppercase tracking-widest"
          style={{ color: "#ff716c", fontWeight: 510, fontFeatureSettings: FF }}
        >
          Failed to load dashboard data. Please refresh the page.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">

      {/* ── Hero bento row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6 mb-10">

        {/* Featured action card — 8 cols */}
        <div
          className="col-span-12 lg:col-span-8 rounded-xl p-8 relative overflow-hidden border"
          style={{
            background: "#191a1b",
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          {/* Subtle brand glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(circle at 25% 50%, rgba(94,106,210,0.07) 0%, transparent 60%)",
              zIndex: 0,
            }}
          />
          <div className="relative z-10 flex flex-col h-full justify-between min-h-[220px]">
            <div>
              <span
                className="inline-block px-3 py-1 rounded-full text-[10px] tracking-widest uppercase mb-6 border"
                style={{
                  background: "rgba(94,106,210,0.1)",
                  color: "#7170ff",
                  borderColor: "rgba(113,112,255,0.2)",
                  fontWeight: 510,
                  fontFeatureSettings: FF,
                }}
              >
                {isAdmin ? "System Pulse" : "Reviewer Session"}
              </span>
              <h2
                className="text-4xl mb-4 max-w-lg leading-tight"
                style={{
                  color: "#f7f8f8",
                  fontWeight: 510,
                  letterSpacing: "-0.704px",
                  fontFeatureSettings: FF,
                }}
              >
                {isAdmin ? (
                  <>Ready for the next{" "}<span style={{ color: "#7170ff" }}>Operational Review?</span></>
                ) : (
                  <>Your calls are{" "}<span style={{ color: "#7170ff" }}>waiting for review.</span></>
                )}
              </h2>
              <p
                className="text-sm max-w-md leading-relaxed"
                style={{ color: "#8a8f98", fontFeatureSettings: FF }}
              >
                {isAdmin
                  ? `There are ${callsLoading ? "…" : pending} pending calls waiting for verification. All system nodes operating within optimal parameters.`
                  : `You have ${callsLoading ? "…" : pending} pending and ${callsLoading ? "…" : completed} completed calls in your queue.`
                }
              </p>
            </div>
            <div className="mt-8 flex items-center gap-3 flex-wrap">
              <button
                className="px-6 py-3 rounded-md text-sm transition-all active:scale-[0.98]"
                style={{
                  background: "#5e6ad2",
                  color: "#f7f8f8",
                  fontWeight: 510,
                  fontFeatureSettings: FF,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#828fff"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#5e6ad2"; }}
                onClick={() => firstPendingId ? navigate(`/eval/${firstPendingId}`) : navigate("/calls")}
              >
                Start Reviewing
              </button>
              <button
                className="px-6 py-3 rounded-md text-sm transition-all border"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: "#d0d6e0",
                  borderColor: "rgba(255,255,255,0.08)",
                  fontWeight: 400,
                  fontFeatureSettings: FF,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
                }}
                onClick={() => navigate("/calls")}
              >
                View Queue
              </button>
            </div>
          </div>
        </div>

        {/* Side metrics — 4 cols */}
        <div className="col-span-12 lg:col-span-4 grid grid-rows-2 gap-6">
          {/* Pending Calls */}
          <div
            className="rounded-xl p-6 flex flex-col justify-between border"
            style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <div className="flex justify-between items-start">
              <span
                className="material-symbols-outlined text-2xl"
                style={{
                  color: "#62666d",
                  fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                }}
              >
                pending_actions
              </span>
              <span
                className="text-[10px]"
                style={{ color: "#ff716c", fontWeight: 510, fontFeatureSettings: FF }}
              >
                {pending > 0 ? `+${pending} open` : "All clear"}
              </span>
            </div>
            <div>
              <p
                className="text-[10px] uppercase tracking-widest mb-1"
                style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
              >
                Pending Calls
              </p>
              {callsLoading ? (
                <Skeleton className="h-12 w-20 mt-1" style={{ background: "rgba(255,255,255,0.05)" }} />
              ) : (
                <h3
                  className="text-5xl"
                  style={{
                    color: "#f7f8f8",
                    fontWeight: 590,
                    letterSpacing: "-1.056px",
                    fontFeatureSettings: FF,
                  }}
                >
                  {pending}
                </h3>
              )}
            </div>
          </div>

          {/* Completed */}
          <div
            className="rounded-xl p-6 flex flex-col justify-between border"
            style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <div className="flex justify-between items-start">
              <span
                className="material-symbols-outlined text-2xl"
                style={{
                  color: "#10b981",
                  fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                }}
              >
                task_alt
              </span>
              <span
                className="text-[10px]"
                style={{ color: "#10b981", fontWeight: 510, fontFeatureSettings: FF }}
              >
                {completed > 0 ? `${Math.round((completed / Math.max(1, completed + pending)) * 100)}%` : "—"}
              </span>
            </div>
            <div>
              <p
                className="text-[10px] uppercase tracking-widest mb-1"
                style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
              >
                Completed
              </p>
              {callsLoading ? (
                <Skeleton className="h-12 w-20 mt-1" style={{ background: "rgba(255,255,255,0.05)" }} />
              ) : (
                <h3
                  className="text-5xl"
                  style={{
                    color: "#f7f8f8",
                    fontWeight: 590,
                    letterSpacing: "-1.056px",
                    fontFeatureSettings: FF,
                  }}
                >
                  {completed.toLocaleString()}
                </h3>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── System Status ─────────────────────────────────────────────── */}
      <div className="mb-10 flex items-center gap-3">
        <h4
          className="text-base"
          style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
        >
          System Status
        </h4>
        {healthLoading ? (
          <span
            className="text-[10px] uppercase tracking-widest"
            style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
          >
            Checking…
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: backendOnline ? "#10b981" : "#ff716c" }}
            />
            <span
              className="text-[10px] uppercase tracking-widest"
              style={{
                color: backendOnline ? "#10b981" : "#ff716c",
                fontWeight: 510,
                fontFeatureSettings: FF,
              }}
            >
              {backendOnline ? "Backend Online" : "Backend Unreachable"}
            </span>
          </div>
        )}
      </div>

      {/* ── Bottom row ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6">

        {/* System Performance — 7 cols */}
        <div className="col-span-12 lg:col-span-7">
          <h4
            className="text-base mb-6"
            style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
          >
            System Performance
          </h4>
          <div
            className="rounded-xl p-6 border flex flex-col justify-end relative overflow-hidden min-h-[280px]"
            style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
          >
            {/* Subtle grid texture */}
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                backgroundImage: "linear-gradient(rgba(113,112,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(113,112,255,0.03) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            <div className="relative z-10">
              <div className="flex gap-10 mb-6">
                <div>
                  <p
                    className="text-[10px] uppercase tracking-widest mb-1"
                    style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
                  >
                    {isAdmin ? "Total Calls" : "My Total Calls"}
                  </p>
                  <p
                    className="text-3xl"
                    style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF, letterSpacing: "-0.288px" }}
                  >
                    {callsLoading ? "…" : (calls?.length ?? 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p
                    className="text-[10px] uppercase tracking-widest mb-1"
                    style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
                  >
                    Completion Rate
                  </p>
                  <p
                    className="text-3xl"
                    style={{ color: "#10b981", fontWeight: 510, fontFeatureSettings: FF, letterSpacing: "-0.288px" }}
                  >
                    {callsLoading || !calls?.length
                      ? "—"
                      : `${Math.round((completed / Math.max(1, completed + pending)) * 100)}%`
                    }
                  </p>
                </div>
                {isAdmin && envBreakdown.length > 0 && (
                  <div>
                    <p
                      className="text-[10px] uppercase tracking-widest mb-1"
                      style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
                    >
                      Top Env
                    </p>
                    <p
                      className="text-3xl"
                      style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF, letterSpacing: "-0.288px" }}
                    >
                      {envBreakdown[0]?.env ?? "—"}
                    </p>
                  </div>
                )}
              </div>

              {/* Traffic chart */}
              {callsLoading ? (
                <div className="h-32 flex items-end gap-1">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm animate-pulse"
                      style={{ height: `${20 + Math.random() * 80}%`, background: "rgba(94,106,210,0.08)" }}
                    />
                  ))}
                </div>
              ) : (
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trafficData} barCategoryGap="20%">
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#62666d", fontSize: 10, fontWeight: 510 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        cursor={false}
                        content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div
                              className="border rounded-md px-3 py-2 text-[10px] uppercase tracking-widest"
                              style={{
                                background: "#191a1b",
                                borderColor: "rgba(255,255,255,0.08)",
                                color: "#7170ff",
                                fontWeight: 510,
                              }}
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
                          return <Cell key={i} fill={`rgba(94,106,210,${opacity})`} />;
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
            <h4
              className="text-base"
              style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
            >
              {isAdmin ? "Review Log" : "My Recent Calls"}
            </h4>
            <button
              className="text-[10px] uppercase tracking-widest transition-colors"
              style={{ color: "#7170ff", fontWeight: 510, fontFeatureSettings: FF }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#828fff"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#7170ff"; }}
              onClick={() => navigate("/calls")}
            >
              View All
            </button>
          </div>

          <div className="space-y-2">
            {calls && calls.length > 0
              ? calls.slice(0, 4).map(({ call, eval: ev }) => (
                  <ReviewLogItem
                    key={call.id}
                    icon={ev.status === "completed" ? "verified" : ev.status === "pending" ? "pending_actions" : "mic"}
                    iconColor={ev.status === "completed" ? "#10b981" : ev.status === "pending" ? "#8a8f98" : "#62666d"}
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

          {/* Team progress */}
          {!isAdmin && team && team.length > 0 && (
            <div
              className="mt-4 rounded-xl p-5 border"
              style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
            >
              <p
                className="text-[10px] uppercase tracking-widest mb-4"
                style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
              >
                Team Progress
              </p>
              <div className="space-y-3">
                {(team ?? []).slice(0, 3).map((m) => (
                  <div key={m.id} className="flex items-center gap-4">
                    <div
                      className="w-16 text-[10px] uppercase tracking-widest truncate"
                      style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
                    >
                      {m.name.split(" ")[0]}
                    </div>
                    <div
                      className="flex-1 h-px rounded-full overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${m.completion_pct}%`, background: "#5e6ad2" }}
                      />
                    </div>
                    <div
                      className="w-8 text-right text-[10px]"
                      style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
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
/*  ReviewLogItem                                                       */
/* ──────────────────────────────────────────────────────────────────── */

function ReviewLogItem({
  icon, iconColor, title, meta, onClick,
}: {
  icon: string; iconColor: string; title: string; meta: string; onClick?: () => void;
}) {
  return (
    <div
      className="p-3.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all duration-150"
      style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)";
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)";
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.06)";
      }}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 border"
          style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}
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
          <p
            className="text-xs"
            style={{ color: "#d0d6e0", fontWeight: 510, fontFeatureSettings: '"cv01", "ss03"' }}
          >
            {title}
          </p>
          <p
            className="text-[10px]"
            style={{ color: "#62666d", fontFeatureSettings: '"cv01", "ss03"' }}
          >
            {meta}
          </p>
        </div>
      </div>
      <span
        className="material-symbols-outlined text-sm"
        style={{
          color: "#62666d",
          fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
        }}
      >
        chevron_right
      </span>
    </div>
  );
}
