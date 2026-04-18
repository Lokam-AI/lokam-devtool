import { useMemo } from "react";
import { useTeam } from "@/hooks/use-calls";
import { Skeleton } from "@/components/ui/skeleton";

const FF = '"cv01", "ss03"' as const;

export default function TeamPage() {
  const { data, isLoading } = useTeam();

  const totalAssigned   = useMemo(() => data?.reduce((s, m) => s + m.calls_assigned,  0) ?? 0, [data]);
  const totalPending    = useMemo(() => data?.reduce((s, m) => s + m.calls_pending,   0) ?? 0, [data]);
  const totalCompleted  = useMemo(() => data?.reduce((s, m) => s + m.completed_total, 0) ?? 0, [data]);
  const completedToday  = useMemo(() => data?.reduce((s, m) => s + m.completed_today, 0) ?? 0, [data]);

  const overallPct = totalAssigned > 0 ? Math.round(totalCompleted / totalAssigned * 100) : 0;

  const avgCorrectionRate = useMemo(() => {
    if (!data || data.length === 0) return 0;
    const active = data.filter((m) => m.completed_total > 0);
    if (!active.length) return 0;
    return Math.round(active.reduce((s, m) => s + m.correction_rate, 0) / active.length);
  }, [data]);

  const avgNps = useMemo(() => {
    if (!data) return null;
    const withNps = data.filter((m) => m.avg_nps !== null);
    if (!withNps.length) return null;
    return (withNps.reduce((s, m) => s + m.avg_nps!, 0) / withNps.length).toFixed(1);
  }, [data]);

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div>
        <h1
          className="text-3xl tracking-tight"
          style={{ color: "#f7f8f8", fontWeight: 590, letterSpacing: "-0.704px", fontFeatureSettings: FF }}
        >
          Team Overview
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#8a8f98", fontFeatureSettings: FF }}>
          Reviewer workload, completion, and annotation quality.
        </p>
      </div>

      {/* ── Summary metrics ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Reviewers",       value: data?.length ?? 0,    fmt: (v: number) => String(v)                    },
          { label: "Total Assigned",  value: totalAssigned,        fmt: (v: number) => String(v)                    },
          { label: "Completed",       value: totalCompleted,       fmt: (v: number) => String(v)                    },
          { label: "Pending",         value: totalPending,         fmt: (v: number) => String(v)                    },
          { label: "Done Today",      value: completedToday,       fmt: (v: number) => String(v)                    },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl p-5 border"
            style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <span
              className="text-[10px] uppercase tracking-[0.05em]"
              style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
            >
              {s.label}
            </span>
            <div className="mt-2">
              {isLoading ? (
                <Skeleton className="h-8 w-14" style={{ background: "rgba(255,255,255,0.05)" }} />
              ) : (
                <span
                  className="text-2xl tracking-tight"
                  style={{ color: "#f7f8f8", fontWeight: 590, fontFeatureSettings: FF }}
                >
                  {s.fmt(s.value)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Main grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6">

        {/* Performance table — 8 cols */}
        <div
          className="col-span-12 lg:col-span-8 rounded-2xl p-8 border"
          style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div className="flex justify-between items-center mb-6">
            <h3
              className="text-xs uppercase tracking-widest"
              style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}
            >
              Reviewer Breakdown
            </h3>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#10b981" }} />
              <span
                className="text-[10px] uppercase tracking-widest"
                style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
              >
                Live
              </span>
            </div>
          </div>

          <table className="w-full text-left">
            <thead>
              <tr>
                {[
                  { label: "Reviewer",        align: "left"  },
                  { label: "Assigned",        align: "left"  },
                  { label: "Pending",         align: "left"  },
                  { label: "Correction Rate", align: "left"  },
                  { label: "Avg NPS",         align: "right" },
                ].map((h) => (
                  <th
                    key={h.label}
                    className="pb-4 text-[10px] uppercase tracking-widest"
                    style={{
                      color: "#62666d",
                      fontWeight: 510,
                      fontFeatureSettings: FF,
                      textAlign: h.align as React.CSSProperties["textAlign"],
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="py-4">
                          <Skeleton className="h-4 w-16" style={{ background: "rgba(255,255,255,0.05)" }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : (data ?? []).map((member) => {
                    const initials = member.name
                      .split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                    const pct = member.completion_pct;
                    const isTop = pct >= 75;

                    return (
                      <tr
                        key={member.id}
                        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                      >
                        {/* Reviewer */}
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] border"
                              style={{
                                background: isTop ? "rgba(113,112,255,0.1)" : "rgba(255,255,255,0.04)",
                                color:      isTop ? "#7170ff"               : "rgba(255,255,255,0.4)",
                                borderColor: isTop ? "rgba(113,112,255,0.2)" : "rgba(255,255,255,0.07)",
                                fontWeight: 510,
                                fontFeatureSettings: FF,
                              }}
                            >
                              {initials}
                            </div>
                            <div>
                              <div
                                className="text-sm"
                                style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
                              >
                                {member.name}
                              </div>
                              <div
                                className="text-[10px] capitalize"
                                style={{ color: "#62666d", fontFeatureSettings: FF }}
                              >
                                {member.role}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Assigned + progress */}
                        <td className="py-4">
                          <div className="flex flex-col gap-1.5">
                            <span
                              className="text-sm"
                              style={{ color: "#8a8f98", fontFamily: "Berkeley Mono, ui-monospace, monospace" }}
                            >
                              {member.completed_total}/{member.calls_assigned}
                            </span>
                            <div className="w-20 h-px rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${Math.min(100, pct)}%`,
                                  background: isTop ? "#5e6ad2" : "rgba(94,106,210,0.35)",
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Pending */}
                        <td className="py-4">
                          <span
                            className="text-sm"
                            style={{
                              color: member.calls_pending > 0 ? "#d0d6e0" : "#62666d",
                              fontFamily: "Berkeley Mono, ui-monospace, monospace",
                            }}
                          >
                            {member.calls_pending}
                          </span>
                        </td>

                        {/* Correction rate */}
                        <td className="py-4">
                          {member.completed_total > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-px rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.min(100, member.correction_rate)}%`,
                                    background: member.correction_rate > 60
                                      ? "#10b981"
                                      : member.correction_rate > 30
                                      ? "#5e6ad2"
                                      : "rgba(255,255,255,0.2)",
                                  }}
                                />
                              </div>
                              <span
                                className="text-[11px] w-9"
                                style={{ color: "#8a8f98", fontFamily: "Berkeley Mono, ui-monospace, monospace" }}
                              >
                                {member.correction_rate}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px]" style={{ color: "#62666d" }}>—</span>
                          )}
                        </td>

                        {/* Avg NPS */}
                        <td className="py-4 text-right">
                          {member.avg_nps !== null ? (
                            <span
                              className="text-sm"
                              style={{
                                color: member.avg_nps >= 8 ? "#10b981" : member.avg_nps >= 6 ? "#7170ff" : "#8a8f98",
                                fontFamily: "Berkeley Mono, ui-monospace, monospace",
                                fontWeight: 510,
                              }}
                            >
                              {member.avg_nps.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-[11px]" style={{ color: "#62666d" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>

        {/* Right column — 4 cols */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-5">

          {/* Overall completion */}
          <div
            className="rounded-2xl p-6 border relative overflow-hidden"
            style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <div
              className="absolute pointer-events-none inset-0"
              style={{ background: "radial-gradient(circle at 30% 30%, rgba(94,106,210,0.06) 0%, transparent 70%)" }}
            />
            <div className="relative z-10">
              <span
                className="text-[10px] uppercase tracking-[0.05em]"
                style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}
              >
                Overall Completion
              </span>
              {isLoading ? (
                <Skeleton className="h-12 w-20 mt-4" style={{ background: "rgba(255,255,255,0.05)" }} />
              ) : (
                <>
                  <div
                    className="mt-3"
                    style={{ fontSize: "44px", color: "#f7f8f8", fontWeight: 590, letterSpacing: "-1px", fontFeatureSettings: FF }}
                  >
                    {overallPct}<span style={{ color: "#10b981" }}>%</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-sm" style={{ color: "#10b981", fontWeight: 510, fontFeatureSettings: FF }}>
                      {totalCompleted}/{totalAssigned}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest" style={{ color: "#62666d", fontFeatureSettings: FF }}>
                      calls done
                    </span>
                  </div>
                  <div className="mt-4 h-px rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${overallPct}%`, background: "#5e6ad2" }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Correction rate */}
          <div
            className="rounded-2xl p-6 border"
            style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <span
              className="text-[10px] uppercase tracking-[0.05em]"
              style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}
            >
              Avg Correction Rate
            </span>
            {isLoading ? (
              <Skeleton className="h-10 w-20 mt-4" style={{ background: "rgba(255,255,255,0.05)" }} />
            ) : (
              <>
                <div
                  className="mt-3"
                  style={{ fontSize: "36px", color: "#f7f8f8", fontWeight: 590, letterSpacing: "-0.8px", fontFeatureSettings: FF }}
                >
                  {avgCorrectionRate}<span style={{ color: "#7170ff", fontSize: "24px" }}>%</span>
                </div>
                <p className="mt-1.5 text-[11px]" style={{ color: "#62666d", fontFeatureSettings: FF }}>
                  of completed evals had AI corrections
                </p>
              </>
            )}
          </div>

          {/* Avg NPS */}
          <div
            className="rounded-2xl p-6 border"
            style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <span
              className="text-[10px] uppercase tracking-[0.05em]"
              style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}
            >
              Avg Ground-Truth NPS
            </span>
            {isLoading ? (
              <Skeleton className="h-10 w-16 mt-4" style={{ background: "rgba(255,255,255,0.05)" }} />
            ) : (
              <>
                <div
                  className="mt-3"
                  style={{
                    fontSize: "36px",
                    color: avgNps !== null
                      ? (parseFloat(avgNps) >= 8 ? "#10b981" : parseFloat(avgNps) >= 6 ? "#7170ff" : "#8a8f98")
                      : "#62666d",
                    fontWeight: 590,
                    letterSpacing: "-0.8px",
                    fontFeatureSettings: FF,
                  }}
                >
                  {avgNps ?? "—"}
                </div>
                <p className="mt-1.5 text-[11px]" style={{ color: "#62666d", fontFeatureSettings: FF }}>
                  reviewer-assigned NPS average
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Status banner ────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border relative overflow-hidden p-8 flex items-center justify-between"
        style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(135deg, rgba(94,106,210,0.05) 0%, transparent 60%)" }}
        />
        <div className="relative z-10">
          <p
            className="text-[10px] uppercase tracking-[0.2em] mb-2"
            style={{ color: "#7170ff", fontWeight: 510, fontFeatureSettings: FF }}
          >
            Queue Status
          </p>
          <h4
            className="text-xl tracking-tight max-w-lg"
            style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
          >
            {isLoading
              ? "Loading…"
              : totalPending === 0
                ? "All queues cleared. Team at full completion capacity."
                : `${totalPending} call${totalPending !== 1 ? "s" : ""} pending across ${data?.filter((m) => m.calls_pending > 0).length ?? 0} reviewer${(data?.filter((m) => m.calls_pending > 0).length ?? 0) !== 1 ? "s" : ""}.`
            }
          </h4>
        </div>
        <div className="relative z-10 flex gap-8 shrink-0 ml-8">
          {[
            { label: "Reviewers",   value: isLoading ? "—" : String(data?.length ?? 0)  },
            { label: "Pending",     value: isLoading ? "—" : String(totalPending)        },
            { label: "Done Today",  value: isLoading ? "—" : String(completedToday)      },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>
                {label}
              </div>
              <div className="text-2xl" style={{ color: "#f7f8f8", fontWeight: 590, fontFeatureSettings: FF }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
