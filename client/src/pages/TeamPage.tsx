import { useMemo } from "react";
import { useTeam } from "@/hooks/use-calls";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeamPage() {
  const { data, isLoading } = useTeam();

  const avgCompletion  = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return Math.round(data.reduce((s, m) => s + m.completion_pct, 0) / data.length);
  }, [data]);

  const totalAssigned  = useMemo(() => data?.reduce((s, m) => s + m.calls_assigned,  0) ?? 0, [data]);
  const totalCompleted = useMemo(() => data?.reduce((s, m) => s + m.completed_today, 0) ?? 0, [data]);
  const totalPending   = totalAssigned - totalCompleted;

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-[0.02em]" style={{ color: "#ffffff" }}>
            Team Overview
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#adaaaa" }}>
            Real-time reviewer performance and queue distribution.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{ background: "rgba(255,255,255,0.06)", color: "#adaaaa" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}
          >
            Export Log
          </button>
          <button
            className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
            style={{
              background: "linear-gradient(135deg,#4ff5df,#22dbc6)",
              color: "#00594f",
              boxShadow: "0 8px 24px rgba(79,245,223,0.2)",
            }}
          >
            Optimize Queue
          </button>
        </div>
      </div>

      {/* ── Summary metric row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: "Reviewers",       value: data?.length ?? 0,    icon: "group",        accent: false },
          { label: "Total Assigned",  value: totalAssigned,         icon: "assignment",   accent: false },
          { label: "Completed Today", value: totalCompleted,        icon: "task_alt",     accent: true  },
          { label: "Pending",         value: totalPending,          icon: "hourglass_top",accent: totalPending > 0 },
        ].map((s) => (
          <div
            key={s.label}
            className="relative overflow-hidden rounded-xl p-5 border"
            style={{
              background: "#1a1919",
              borderColor: s.accent ? "rgba(79,245,223,0.15)" : "rgba(73,72,71,0.05)",
            }}
          >
            {s.accent && (
              <div
                className="absolute pointer-events-none inset-0"
                style={{ background: "rgba(79,245,223,0.02)" }}
              />
            )}
            <div className="flex justify-between items-start mb-2 relative z-10">
              <span className="text-[10px] font-bold uppercase tracking-[0.05em]" style={{ color: "#adaaaa" }}>
                {s.label}
              </span>
              <span
                className="material-symbols-outlined text-lg"
                style={{
                  color: s.accent ? "#4ff5df" : "rgba(173,170,170,0.25)",
                  fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                }}
              >
                {s.icon}
              </span>
            </div>
            <div className="relative z-10">
              {isLoading ? (
                <Skeleton className="h-9 w-16" style={{ background: "rgba(255,255,255,0.05)" }} />
              ) : (
                <span className="text-3xl font-black tracking-tight" style={{ color: "#ffffff" }}>
                  {s.value}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Main grid: 8 + 4 ────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6">

        {/* Performance table — 8 cols */}
        <div
          className="col-span-12 lg:col-span-8 rounded-2xl p-8 border"
          style={{ background: "#1a1919", borderColor: "rgba(73,72,71,0.05)" }}
        >
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#adaaaa" }}>
              Performance Distribution
            </h3>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#4ff5df" }} />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(173,170,170,0.4)" }}>
                Live
              </span>
            </div>
          </div>

          <table className="w-full text-left">
            <thead>
              <tr>
                {["Reviewer", "Assigned", "Completed", "Progress", "Status"].map((h, i) => (
                  <th
                    key={h}
                    className="pb-5 text-[10px] font-bold uppercase tracking-widest"
                    style={{
                      color: "#adaaaa",
                      paddingLeft: i === 0 ? "8px" : undefined,
                      paddingRight: i === 4 ? "8px" : undefined,
                      textAlign: i === 4 ? "right" : undefined,
                      width: i === 3 ? "180px" : undefined,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} style={{ borderTop: "1px solid rgba(73,72,71,0.05)" }}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="py-5 pl-2">
                          <Skeleton className="h-4 w-20" style={{ background: "rgba(255,255,255,0.05)" }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : data?.map((member) => {
                    const initials = member.name
                      .split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                    const pct       = Math.min(100, member.completion_pct);
                    const isTop     = pct >= 80;
                    const isActive  = pct >= 50 && pct < 100;
                    const isBehind  = pct < 50;

                    return (
                      <tr
                        key={member.id}
                        className="transition-colors"
                        style={{ borderTop: "1px solid rgba(73,72,71,0.05)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                      >
                        {/* Reviewer */}
                        <td className="py-5 pl-2">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold border"
                              style={{
                                background: isTop ? "rgba(79,245,223,0.1)" : "rgba(255,255,255,0.04)",
                                color:      isTop ? "#4ff5df"               : "rgba(255,255,255,0.4)",
                                borderColor: isTop ? "rgba(79,245,223,0.25)" : "rgba(255,255,255,0.07)",
                              }}
                            >
                              {initials}
                            </div>
                            <div>
                              <div className="text-sm font-semibold" style={{ color: "#ffffff" }}>
                                {member.name}
                              </div>
                              <div className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(173,170,170,0.5)" }}>
                                Reviewer
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Assigned */}
                        <td className="py-5 font-mono text-sm" style={{ color: "#adaaaa" }}>
                          {member.calls_assigned}
                        </td>

                        {/* Completed */}
                        <td className="py-5 font-mono text-sm" style={{ color: "#adaaaa" }}>
                          {member.completed_today}
                        </td>

                        {/* Progress bar */}
                        <td className="py-5 pr-6">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex-1 h-1.5 rounded-full overflow-hidden"
                              style={{ background: "rgba(0,0,0,0.5)" }}
                            >
                              <div
                                className="h-full rounded-full transition-all duration-1000"
                                style={{
                                  width: `${pct}%`,
                                  background: isTop ? "#4ff5df" : "rgba(79,245,223,0.4)",
                                  boxShadow: isTop ? "0 0 8px rgba(79,245,223,0.4)" : "none",
                                }}
                              />
                            </div>
                            <span
                              className="text-[10px] font-bold w-9 text-right shrink-0"
                              style={{ color: isTop ? "#4ff5df" : "rgba(255,255,255,0.35)" }}
                            >
                              {pct}%
                            </span>
                          </div>
                        </td>

                        {/* Status pill */}
                        <td className="py-5 pr-2 text-right">
                          {pct >= 100 ? (
                            <span
                              className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}
                            >
                              Complete
                            </span>
                          ) : isActive ? (
                            <span
                              className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                              style={{ background: "rgba(79,245,223,0.12)", color: "#4ff5df" }}
                            >
                              Active
                            </span>
                          ) : isBehind ? (
                            <span
                              className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                              style={{ background: "rgba(234,179,8,0.12)", color: "#eab308" }}
                            >
                              Behind
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>

        {/* Right column — 4 cols */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">

          {/* Team efficiency */}
          <div
            className="flex-1 rounded-2xl p-6 border relative overflow-hidden"
            style={{ background: "#1a1919", borderColor: "rgba(73,72,71,0.05)" }}
          >
            {/* Aurora glow */}
            <div
              className="absolute pointer-events-none"
              style={{
                top: "-20px", left: "-20px", right: "-20px", bottom: "-20px",
                background: "radial-gradient(circle at center, rgba(79,245,223,0.07) 0%, transparent 70%)",
                filter: "blur(40px)",
              }}
            />
            <div className="relative z-10 flex flex-col h-full justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.05em]" style={{ color: "#adaaaa" }}>
                Team Efficiency
              </span>
              <div>
                {isLoading ? (
                  <Skeleton className="h-14 w-24 mt-4" style={{ background: "rgba(255,255,255,0.05)" }} />
                ) : (
                  <>
                    <div className="text-5xl font-black tracking-tighter mt-4" style={{ color: "#ffffff" }}>
                      {avgCompletion}<span style={{ color: "#4ff5df" }}>%</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm font-bold" style={{ color: "#4ff5df" }}>
                        {totalCompleted}/{totalAssigned}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                        calls done
                      </span>
                    </div>
                    {/* Efficiency bar */}
                    <div
                      className="mt-4 h-1.5 rounded-full overflow-hidden"
                      style={{ background: "rgba(0,0,0,0.5)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${avgCompletion}%`,
                          background: "linear-gradient(90deg, #4ff5df, #22dbc6)",
                          boxShadow: "0 0 8px rgba(79,245,223,0.4)",
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Queue load */}
          <div
            className="flex-1 rounded-2xl p-6 border relative overflow-hidden"
            style={{ background: "#1a1919", borderColor: "rgba(73,72,71,0.05)" }}
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.05em] relative z-10" style={{ color: "#adaaaa" }}>
              Queue Load
            </span>
            <div className="flex items-end gap-1.5 mt-6 relative z-10">
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-2.5 rounded-sm animate-pulse" style={{ height: `${20 + i * 8}px`, background: "rgba(255,255,255,0.07)" }} />
                  ))
                : (data ?? []).flatMap((m, i) => [
                    <div
                      key={`a${i}`}
                      className="w-2.5 rounded-sm transition-all duration-700"
                      style={{
                        height: `${Math.max(10, (m.completion_pct / 100) * 64)}px`,
                        background: "#4ff5df",
                        opacity: 0.7 + (m.completion_pct / 100) * 0.3,
                      }}
                    />,
                    <div
                      key={`b${i}`}
                      className="w-2.5 rounded-sm"
                      style={{
                        height: `${Math.max(6, ((m.calls_assigned - m.completed_today) / Math.max(1, m.calls_assigned)) * 48)}px`,
                        background: "rgba(255,255,255,0.08)",
                      }}
                    />,
                  ])
              }
              <div className="ml-3">
                {isLoading ? (
                  <Skeleton className="h-8 w-16" style={{ background: "rgba(255,255,255,0.05)" }} />
                ) : (
                  <>
                    <div className="text-2xl font-black" style={{ color: "#ffffff" }}>{totalPending}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>pending</div>
                  </>
                )}
              </div>
            </div>
            <div
              className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full"
              style={{ background: "rgba(79,245,223,0.04)", filter: "blur(40px)" }}
            />
          </div>
        </div>
      </div>

      {/* ── Bottom grid: 4 + 8 ──────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6">

        {/* Active assignments — 4 cols */}
        <div
          className="col-span-12 lg:col-span-4 rounded-2xl p-8 border"
          style={{ background: "#1a1919", borderColor: "rgba(73,72,71,0.05)" }}
        >
          <h3 className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: "#adaaaa" }}>
            Active Assignments
          </h3>
          <div className="space-y-3">
            {[
              {
                label: "Pending Review",
                value: isLoading ? "—" : `${totalPending} Active`,
                highlight: true,
              },
              {
                label: "Completed Today",
                value: isLoading ? "—" : `${totalCompleted} Done`,
                highlight: false,
              },
              {
                label: "Review Queue",
                value: isLoading ? "—" : totalPending === 0 ? "Cleared" : `${totalAssigned} Total`,
                highlight: false,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex justify-between items-center p-4 rounded-xl border"
                style={{
                  background: item.highlight ? "rgba(79,245,223,0.04)" : "rgba(255,255,255,0.02)",
                  borderColor: item.highlight ? "rgba(79,245,223,0.12)" : "rgba(255,255,255,0.05)",
                }}
              >
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#ffffff" }}>
                  {item.label}
                </span>
                <span
                  className="text-[10px] font-mono font-bold"
                  style={{ color: item.highlight ? "#4ff5df" : "#adaaaa" }}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Operational status banner — 8 cols */}
        <div
          className="col-span-12 lg:col-span-8 rounded-2xl border relative overflow-hidden p-8 flex flex-col justify-between"
          style={{ background: "#1a1919", borderColor: "rgba(73,72,71,0.05)" }}
        >
          {/* Aurora tint */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(135deg, rgba(79,245,223,0.04) 0%, transparent 60%)" }}
          />
          <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#4ff5df" }}>
              Operational Context
            </p>
            <h4 className="text-2xl font-bold tracking-tight max-w-lg leading-snug" style={{ color: "#ffffff" }}>
              {isLoading
                ? "Loading system status…"
                : totalPending === 0
                  ? "All queues cleared. Team at full completion capacity."
                  : `${totalPending} calls pending review across ${data?.filter((m) => m.completion_pct < 100).length ?? 0} active reviewers.`
              }
            </h4>
          </div>

          <div className="relative z-10 flex items-center justify-between mt-8 flex-wrap gap-6">
            <div className="flex gap-10">
              {[
                { label: "Reviewers",  value: isLoading ? "—" : String(data?.length ?? 0) },
                { label: "Avg Load",   value: isLoading || !data?.length ? "—" : String(Math.round(totalAssigned / data.length)) },
                { label: "Completion", value: isLoading ? "—" : `${avgCompletion}%`, accent: true },
              ].map(({ label, value, accent }) => (
                <div key={label}>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {label}
                  </div>
                  <div className="text-2xl font-black" style={{ color: accent ? "#4ff5df" : "#ffffff" }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
            <div
              className="flex items-center gap-2 px-5 py-3 rounded-full border"
              style={{ background: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.08)" }}
            >
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#4ff5df" }} />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#ffffff" }}>
                System Live
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
