import { useMemo } from "react";
import { useAuthStore } from "@/store/auth-store";
import { parseUtc } from "@/lib/utils";
import { useCalls, useHealth, useTeam, useDashboardStats } from "@/hooks/use-calls";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Bug, RefreshCw, AlertTriangle } from "lucide-react";

const FF = '"cv01", "ss03"' as const;
const MONO = "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace";

const REVIEW_LOG = [
  { icon: "mic",      iconColor: "#7170ff", title: "Incoming Call #4812",  meta: "Node: Alpha-7 · 2m ago"            },
  { icon: "verified", iconColor: "#10b981", title: "Verification Success", meta: "Internal Review · 15m ago"         },
  { icon: "warning",  iconColor: "#ff716c", title: "Flagged Exception",    meta: "Manual Override Required · 1h ago" },
  { icon: "mic",      iconColor: "#7170ff", title: "Incoming Call #4810",  meta: "Node: Beta-3 · 2h ago"             },
];

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - parseUtc(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DashboardPage() {
  const isAdmin = useAuthStore((s) => s.isAtLeast)("admin");
  const { data: calls, isLoading: callsLoading, isError: callsError } = useCalls();
  const { data: health, isLoading: healthLoading } = useHealth();
  const { data: team } = useTeam();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const navigate = useNavigate();

  const pending        = calls?.filter((c) => c.eval.status === "pending").length   ?? 0;
  const completed      = calls?.filter((c) => c.eval.status === "completed").length ?? 0;
  const firstPendingId = calls?.find((c) => c.eval.status === "pending")?.call.id;

  const backendOnline = !healthLoading && health?.status === "ok";

  // NPS totals
  const npsScored = (stats?.nps.promoters ?? 0) + (stats?.nps.neutrals ?? 0) + (stats?.nps.detractors ?? 0);
  const npsTotal  = npsScored + (stats?.nps.unscored ?? 0);
  const promoterPct  = npsScored ? Math.round((stats!.nps.promoters  / npsScored) * 100) : 0;
  const neutralPct   = npsScored ? Math.round((stats!.nps.neutrals   / npsScored) * 100) : 0;
  const detractorPct = npsScored ? Math.round((stats!.nps.detractors / npsScored) * 100) : 0;

  if (callsError) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-xs uppercase tracking-widest" style={{ color: "#ff716c", fontWeight: 510, fontFeatureSettings: FF }}>
          Failed to load dashboard data. Please refresh the page.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 space-y-10">

      {/* ── Row 1: Hero + side metrics ────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6">

        {/* Hero card */}
        <div
          className="col-span-12 lg:col-span-8 rounded-xl p-8 relative overflow-hidden border"
          style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(circle at 25% 50%, rgba(94,106,210,0.07) 0%, transparent 60%)" }}
          />
          <div className="relative z-10 flex flex-col h-full justify-between min-h-[220px]">
            <div>
              <span
                className="inline-block px-3 py-1 rounded-full text-[10px] tracking-widest uppercase mb-6 border"
                style={{ background: "rgba(94,106,210,0.1)", color: "#7170ff", borderColor: "rgba(113,112,255,0.2)", fontWeight: 510, fontFeatureSettings: FF }}
              >
                {isAdmin ? "System Pulse" : "Reviewer Session"}
              </span>
              <h2
                className="text-4xl mb-4 max-w-lg leading-tight"
                style={{ color: "#f7f8f8", fontWeight: 510, letterSpacing: "-0.704px", fontFeatureSettings: FF }}
              >
                {isAdmin
                  ? <>Ready for the next{" "}<span style={{ color: "#7170ff" }}>Operational Review?</span></>
                  : <>Your calls are{" "}<span style={{ color: "#7170ff" }}>waiting for review.</span></>
                }
              </h2>
              <p className="text-sm max-w-md leading-relaxed" style={{ color: "#8a8f98", fontFeatureSettings: FF }}>
                {isAdmin
                  ? `There are ${callsLoading ? "…" : pending} pending calls waiting for verification. All system nodes operating within optimal parameters.`
                  : `You have ${callsLoading ? "…" : pending} pending and ${callsLoading ? "…" : completed} completed calls in your queue.`
                }
              </p>
            </div>
            <div className="mt-8 flex items-center gap-3 flex-wrap">
              <button
                className="px-6 py-3 rounded-md text-sm transition-all active:scale-[0.98]"
                style={{ background: "#5e6ad2", color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#828fff"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#5e6ad2"; }}
                onClick={() => firstPendingId ? navigate(`/eval/${firstPendingId}`, { state: { editable: true } }) : navigate("/calls")}
              >
                Start Reviewing
              </button>
              <button
                className="px-6 py-3 rounded-md text-sm transition-all border"
                style={{ background: "rgba(255,255,255,0.04)", color: "#d0d6e0", borderColor: "rgba(255,255,255,0.08)", fontWeight: 400, fontFeatureSettings: FF }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
                onClick={() => navigate("/calls")}
              >
                View Queue
              </button>
            </div>
          </div>
        </div>

        {/* Side metrics */}
        <div className="col-span-12 lg:col-span-4 grid grid-rows-2 gap-6">
          <div className="rounded-xl p-6 flex flex-col justify-between border" style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="flex justify-between items-start">
              <span className="material-symbols-outlined text-2xl" style={{ color: "#62666d", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>pending_actions</span>
              <span className="text-[10px]" style={{ color: "#ff716c", fontWeight: 510, fontFeatureSettings: FF }}>{pending > 0 ? `+${pending} open` : "All clear"}</span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>Pending Calls</p>
              {callsLoading
                ? <Skeleton className="h-12 w-20 mt-1" style={{ background: "rgba(255,255,255,0.05)" }} />
                : <h3 className="text-5xl" style={{ color: "#f7f8f8", fontWeight: 590, letterSpacing: "-1.056px", fontFeatureSettings: FF }}>{pending}</h3>
              }
            </div>
          </div>
          <div className="rounded-xl p-6 flex flex-col justify-between border" style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="flex justify-between items-start">
              <span className="material-symbols-outlined text-2xl" style={{ color: "#10b981", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>task_alt</span>
              <span className="text-[10px]" style={{ color: "#10b981", fontWeight: 510, fontFeatureSettings: FF }}>
                {completed > 0 ? `${Math.round((completed / Math.max(1, completed + pending)) * 100)}%` : "—"}
              </span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>Completed</p>
              {callsLoading
                ? <Skeleton className="h-12 w-20 mt-1" style={{ background: "rgba(255,255,255,0.05)" }} />
                : <h3 className="text-5xl" style={{ color: "#f7f8f8", fontWeight: 590, letterSpacing: "-1.056px", fontFeatureSettings: FF }}>{completed.toLocaleString()}</h3>
              }
            </div>
          </div>
        </div>
      </div>

      {/* ── System status bar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <h4 className="text-base" style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}>System Status</h4>
        {healthLoading ? (
          <span className="text-[10px] uppercase tracking-widest" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>Checking…</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: backendOnline ? "#10b981" : "#ff716c" }} />
            <span className="text-[10px] uppercase tracking-widest" style={{ color: backendOnline ? "#10b981" : "#ff716c", fontWeight: 510, fontFeatureSettings: FF }}>
              {backendOnline ? "Backend Online" : "Backend Unreachable"}
            </span>
          </div>
        )}
      </div>

      {/* ── Row 2: NPS + Open Bugs + Sync Health ──────────────────────── */}
      <div className="grid grid-cols-12 gap-6">

          {/* NPS Distribution */}
          <div
            className="col-span-12 lg:col-span-4 rounded-xl p-6 border flex flex-col gap-5"
            style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>NPS Distribution</p>
              <span className="text-[11px]" style={{ color: "#62666d", fontFamily: MONO }}>
                {statsLoading ? "…" : `${npsScored}/${npsTotal} scored`}
              </span>
            </div>

            {statsLoading ? (
              <Skeleton className="h-2 w-full rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
            ) : npsScored === 0 ? (
              <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
            ) : (
              <div className="flex h-2 rounded-full overflow-hidden gap-px">
                {promoterPct  > 0 && <div style={{ width: `${promoterPct}%`,  background: "#10b981" }} />}
                {neutralPct   > 0 && <div style={{ width: `${neutralPct}%`,   background: "#7170ff" }} />}
                {detractorPct > 0 && <div style={{ width: `${detractorPct}%`, background: "#ff716c" }} />}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Promoters",  value: stats?.nps.promoters  ?? 0, color: "#10b981", pct: promoterPct  },
                { label: "Neutrals",   value: stats?.nps.neutrals   ?? 0, color: "#7170ff", pct: neutralPct   },
                { label: "Detractors", value: stats?.nps.detractors ?? 0, color: "#ff716c", pct: detractorPct },
              ].map(({ label, value, color, pct }) => (
                <div
                  key={label}
                  className="rounded-lg p-3 flex flex-col gap-1"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                    <span className="text-[10px] uppercase tracking-wide" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>{label}</span>
                  </div>
                  {statsLoading
                    ? <Skeleton className="h-6 w-8" style={{ background: "rgba(255,255,255,0.05)" }} />
                    : <>
                        <span className="text-xl leading-none" style={{ color: "#f7f8f8", fontWeight: 590, fontFeatureSettings: FF }}>{value}</span>
                        <span className="text-[10px]" style={{ color, fontFamily: MONO }}>{npsScored ? `${pct}%` : "—"}</span>
                      </>
                  }
                </div>
              ))}
            </div>

            <div
              className="flex items-center justify-between rounded-lg px-4 py-3"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <span className="text-[11px]" style={{ color: "#62666d", fontFeatureSettings: FF }}>Correction rate</span>
              {statsLoading
                ? <Skeleton className="h-4 w-10" style={{ background: "rgba(255,255,255,0.05)" }} />
                : <span className="text-[13px]" style={{ color: stats?.correction_rate && stats.correction_rate > 50 ? "#10b981" : "#8a8f98", fontWeight: 510, fontFamily: MONO }}>
                    {stats?.correction_rate ?? 0}%
                  </span>
              }
            </div>
          </div>

          {/* Open Bugs */}
          <div
            className="col-span-12 lg:col-span-4 rounded-xl p-6 border flex flex-col gap-5 cursor-pointer"
            style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
            onClick={() => navigate("/bugs")}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(113,112,255,0.2)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>Open Bugs</p>
              <Bug className="h-3.5 w-3.5" style={{ color: "#62666d" }} />
            </div>

            {statsLoading
              ? <Skeleton className="h-14 w-20" style={{ background: "rgba(255,255,255,0.05)" }} />
              : <div className="flex items-end gap-3">
                  <span
                    style={{ fontSize: "52px", lineHeight: 1, color: stats?.open_bugs ? "#ff716c" : "#10b981", fontWeight: 590, letterSpacing: "-1.056px", fontFeatureSettings: FF }}
                  >
                    {stats?.open_bugs ?? 0}
                  </span>
                  <span className="mb-2 text-[11px]" style={{ color: "#62666d", fontFeatureSettings: FF }}>
                    {stats?.open_bugs === 0 ? "all resolved" : `unresolved bug${stats!.open_bugs !== 1 ? "s" : ""}`}
                  </span>
                </div>
            }

            <div style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />

            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: "#62666d", fontFeatureSettings: FF }}>Synced today</span>
              {statsLoading
                ? <Skeleton className="h-4 w-8" style={{ background: "rgba(255,255,255,0.05)" }} />
                : <span className="text-[13px]" style={{ color: "#8a8f98", fontWeight: 510, fontFamily: MONO }}>{stats?.sync.bugs_today ?? 0}</span>
              }
            </div>

            <div
              className="flex items-center gap-1.5 text-[11px] mt-auto"
              style={{ color: "#7170ff", fontWeight: 510, fontFeatureSettings: FF }}
            >
              <span>View Bug Reports</span>
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>arrow_forward</span>
            </div>
          </div>

          {/* Sync Health */}
          <div
            className="col-span-12 lg:col-span-4 rounded-xl p-6 border flex flex-col gap-4"
            style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>Sync Health</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#10b981" }} />
                <span className="text-[10px] uppercase tracking-widest" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>Live</span>
              </div>
            </div>

            {[
              {
                label: "Last call sync",
                time:  stats?.sync.last_call_sync ?? null,
                count: stats?.sync.calls_today ?? 0,
                unit:  "calls today",
                icon:  "phone_in_talk",
              },
              {
                label: "Last bug sync",
                time:  stats?.sync.last_bug_sync ?? null,
                count: stats?.sync.bugs_today ?? 0,
                unit:  "bugs today",
                icon:  "bug_report",
              },
            ].map(({ label, time, count, unit, icon }) => (
              <div
                key={label}
                className="rounded-lg p-4 flex flex-col gap-2"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm" style={{ color: "#62666d", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>{icon}</span>
                  <span className="text-[11px]" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>{label}</span>
                </div>
                {statsLoading ? (
                  <Skeleton className="h-5 w-24" style={{ background: "rgba(255,255,255,0.05)" }} />
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-[13px]" style={{ color: "#d0d6e0", fontWeight: 510, fontFamily: MONO }}>
                      {relativeTime(time)}
                    </span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded"
                      style={{ background: "rgba(255,255,255,0.04)", color: "#8a8f98", fontFamily: MONO }}
                    >
                      +{count} {unit}
                    </span>
                  </div>
                )}
              </div>
            ))}

            <div
              className="flex items-center justify-between rounded-lg px-4 py-3 mt-auto"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <span className="text-[11px]" style={{ color: "#62666d", fontFeatureSettings: FF }}>Next scheduled sync</span>
              <span className="text-[11px]" style={{ color: "#8a8f98", fontFamily: MONO }}>Daily · 02:00 UTC</span>
            </div>
          </div>
        </div>

      {/* ── Row 3: Review log + reviewer bottleneck ───────────────────── */}
      <div className="grid grid-cols-12 gap-6">

        {/* Review log */}
        <div className="col-span-12 lg:col-span-7">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-base" style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}>
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
              ? calls.slice(0, 5).map(({ call, eval: ev }) => (
                  <ReviewLogItem
                    key={call.id}
                    icon={ev.status === "completed" ? "verified" : "pending_actions"}
                    iconColor={ev.status === "completed" ? "#10b981" : "#8a8f98"}
                    title={`Call #${call.id.slice(-6).toUpperCase()}`}
                    meta={`${call.source_env ?? "unknown"} · ${ev.status}`}
                    onClick={() => navigate(`/eval/${call.id}`)}
                  />
                ))
              : REVIEW_LOG.map((item, i) => (
                  <ReviewLogItem key={i} icon={item.icon} iconColor={item.iconColor} title={item.title} meta={item.meta} />
                ))
            }
          </div>
        </div>

        {/* Reviewer bottleneck / team progress */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-5">

          {/* Queue Bottleneck — visible to all roles */}
          {team && team.length > 0 && (
            <div
              className="rounded-xl p-6 border flex flex-col gap-5"
              style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>Queue Bottleneck</p>
                <span className="text-[10px] uppercase tracking-widest" style={{ color: "#62666d", fontFeatureSettings: FF }}>Pending</span>
              </div>
              <div className="space-y-4">
                {[...team].sort((a, b) => b.calls_pending - a.calls_pending).slice(0, 4).map((m) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] border"
                      style={{
                        background: m.calls_pending > 10 ? "rgba(255,113,108,0.1)" : "rgba(255,255,255,0.04)",
                        color:      m.calls_pending > 10 ? "#ff716c" : "rgba(255,255,255,0.4)",
                        borderColor: m.calls_pending > 10 ? "rgba(255,113,108,0.2)" : "rgba(255,255,255,0.07)",
                        fontWeight: 510,
                      }}
                    >
                      {m.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[12px] truncate" style={{ color: "#d0d6e0", fontWeight: 510, fontFeatureSettings: FF }}>{m.name}</span>
                        <span className="text-[11px] shrink-0 ml-2" style={{ color: m.calls_pending > 10 ? "#ff716c" : "#8a8f98", fontFamily: MONO }}>{m.calls_pending}</span>
                      </div>
                      <div className="h-px rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, m.completion_pct)}%`,
                            background: m.completion_pct >= 75 ? "#10b981" : m.completion_pct >= 40 ? "#5e6ad2" : "rgba(255,113,108,0.6)",
                          }}
                        />
                      </div>
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

function ReviewLogItem({ icon, iconColor, title, meta, onClick }: {
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
          <span className="material-symbols-outlined text-sm" style={{ color: iconColor, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
            {icon}
          </span>
        </div>
        <div>
          <p className="text-xs" style={{ color: "#d0d6e0", fontWeight: 510, fontFeatureSettings: FF }}>{title}</p>
          <p className="text-[10px]" style={{ color: "#62666d", fontFeatureSettings: FF }}>{meta}</p>
        </div>
      </div>
      <span className="material-symbols-outlined text-sm" style={{ color: "#62666d", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>chevron_right</span>
    </div>
  );
}
