import { useState, useMemo, useEffect } from "react";
import { useTeam, useUsers, useCreateUser, useUpdateUser, useAssignmentConfig, useUpdateAssignmentConfig } from "@/hooks/use-calls";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";
import { UserPlus, Users, ShieldCheck, Star, SlidersHorizontal } from "lucide-react";
import type { UserRole } from "@/types";

const FF = '"cv01", "ss03"' as const;

const CATEGORY_LABELS: Record<string, string> = {
  na: "N/A",
  detractor: "Detractor",
  promoter: "Promoter",
  missed: "Missed",
};

const ROLE_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  superadmin: { label: "Superadmin", bg: "rgba(234,179,8,0.12)",   color: "#eab308", border: "rgba(234,179,8,0.2)"   },
  admin:      { label: "Admin",      bg: "rgba(113,112,255,0.1)",  color: "#7170ff", border: "rgba(113,112,255,0.2)" },
  reviewer:   { label: "Reviewer",   bg: "rgba(56,189,248,0.1)",   color: "#38bdf8", border: "rgba(56,189,248,0.2)"  },
};

const CATEGORY_CONFIG = [
  { key: "na",         label: "N/A",        color: "#7170ff", bg: "rgba(113,112,255,0.08)",  border: "rgba(113,112,255,0.2)"  },
  { key: "detractor",  label: "Detractor",  color: "#f87171", bg: "rgba(248,113,113,0.08)",  border: "rgba(248,113,113,0.2)"  },
  { key: "promoter",   label: "Promoter",   color: "#10b981", bg: "rgba(16,185,129,0.08)",   border: "rgba(16,185,129,0.2)"   },
  { key: "missed",     label: "Missed",     color: "#8a8f98", bg: "rgba(138,143,152,0.08)",  border: "rgba(138,143,152,0.15)" },
] as const;

type CatKey = (typeof CATEGORY_CONFIG)[number]["key"];

function AssignmentConfigPanel() {
  const { data, isLoading } = useAssignmentConfig();
  const update = useUpdateAssignmentConfig();

  const [maxCalls, setMaxCalls] = useState<number>(5);
  const [targets, setTargets] = useState<Record<CatKey, number>>({ na: 2, detractor: 1, promoter: 1, missed: 1 });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setMaxCalls(data.max_calls_per_user);
      setTargets(data.call_targets as Record<CatKey, number>);
      setDirty(false);
    }
  }, [data]);

  const allocated = useMemo(
    () => CATEGORY_CONFIG.reduce((s, c) => s + (targets[c.key] ?? 0), 0),
    [targets]
  );
  const remaining = maxCalls - allocated;
  const isOver = remaining < 0;
  const fillPct = Math.min(100, maxCalls > 0 ? (allocated / maxCalls) * 100 : 0);

  const handleSave = async () => {
    if (isOver) return;
    try {
      await update.mutateAsync({ max_calls_per_user: maxCalls, call_targets: targets });
      toast.success("Assignment config saved");
      setDirty(false);
    } catch {
      toast.error("Failed to save config");
    }
  };

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: "#191a1b", borderColor: isOver ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.08)", transition: "border-color 200ms" }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-7 py-5 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(234,179,8,0.1)" }}
          >
            <SlidersHorizontal className="h-[14px] w-[14px]" style={{ color: "#eab308" }} />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-[0.12em]" style={{ color: "#eab308", fontWeight: 510, fontFeatureSettings: FF }}>
              Superadmin
            </span>
            <h2 className="text-sm leading-none mt-0.5" style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}>
              Assignment Config
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {dirty && !update.isPending && (
            <span
              className="text-[10px] uppercase tracking-widest flex items-center gap-1.5"
              style={{ color: "#62666d", fontFeatureSettings: FF }}
            >
              <span className="w-1 h-1 rounded-full" style={{ background: "#eab308" }} />
              Unsaved
            </span>
          )}
          {dirty && (
            <button
              onClick={handleSave}
              disabled={update.isPending || isOver}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] uppercase tracking-widest border transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: isOver ? "rgba(248,113,113,0.08)" : "#5e6ad2", color: isOver ? "#f87171" : "#f7f8f8", borderColor: isOver ? "rgba(248,113,113,0.2)" : "transparent", fontWeight: 510, fontFeatureSettings: FF }}
              onMouseEnter={(e) => { if (!isOver && !update.isPending) (e.currentTarget as HTMLButtonElement).style.background = "#828fff"; }}
              onMouseLeave={(e) => { if (!isOver) (e.currentTarget as HTMLButtonElement).style.background = "#5e6ad2"; }}
            >
              {update.isPending ? "Saving…" : isOver ? "Fix errors" : "Save"}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-7 py-6">
        {isLoading ? (
          <div className="flex gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 flex-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Row: total + categories */}
            <div className="flex flex-wrap gap-3 items-end">
              {/* Total / User */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-[0.1em] pl-1" style={{ color: "#eab308", fontWeight: 510, fontFeatureSettings: FF }}>
                  Total / User
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={maxCalls}
                    onChange={(e) => { setMaxCalls(Math.max(1, Number(e.target.value))); setDirty(true); }}
                    className="rounded-xl px-4 py-3 text-sm border focus:outline-none w-[96px] font-mono"
                    style={{ background: "rgba(234,179,8,0.04)", color: "#eab308", borderColor: "rgba(234,179,8,0.2)", fontFeatureSettings: FF, fontWeight: 510 }}
                    onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(234,179,8,0.5)"; }}
                    onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "rgba(234,179,8,0.2)"; }}
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="self-stretch flex items-center pb-0.5">
                <span className="text-lg" style={{ color: "rgba(255,255,255,0.1)", fontWeight: 300 }}>=</span>
              </div>

              {/* Category inputs */}
              {CATEGORY_CONFIG.map((cat, i) => (
                <div key={cat.key} className="flex items-end gap-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-[0.1em] pl-1" style={{ color: cat.color, fontWeight: 510, fontFeatureSettings: FF, opacity: 0.8 }}>
                      {cat.label}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={maxCalls}
                      value={targets[cat.key]}
                      onChange={(e) => { setTargets((t) => ({ ...t, [cat.key]: Math.max(0, Number(e.target.value)) })); setDirty(true); }}
                      className="rounded-xl px-4 py-3 text-sm border focus:outline-none w-[84px] font-mono"
                      style={{ background: cat.bg, color: cat.color, borderColor: cat.border, fontFeatureSettings: FF, fontWeight: 510 }}
                      onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = cat.color + "80"; }}
                      onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = cat.border; }}
                    />
                  </div>
                  {i < CATEGORY_CONFIG.length - 1 && (
                    <span className="pb-[14px] text-sm" style={{ color: "rgba(255,255,255,0.15)" }}>+</span>
                  )}
                </div>
              ))}
            </div>

            {/* Budget bar */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>
                  Budget used
                </span>
                <span
                  className="text-[11px] font-mono"
                  style={{ color: isOver ? "#f87171" : remaining === 0 ? "#eab308" : "#8a8f98", fontWeight: 510, transition: "color 200ms" }}
                  aria-live="polite"
                >
                  {allocated} / {maxCalls}
                  {isOver
                    ? <span style={{ color: "#f87171" }}> · {Math.abs(remaining)} over budget</span>
                    : remaining > 0
                    ? <span style={{ color: "#62666d" }}> · {remaining} unallocated</span>
                    : <span style={{ color: "#eab308" }}> · fully allocated</span>
                  }
                </span>
              </div>

              {/* Segmented budget bar */}
              <div className="h-1.5 rounded-full overflow-hidden flex gap-px" style={{ background: "rgba(255,255,255,0.05)" }}>
                {maxCalls > 0 && CATEGORY_CONFIG.map((cat) => {
                  const pct = Math.min(100, (targets[cat.key] / maxCalls) * 100);
                  return pct > 0 ? (
                    <div
                      key={cat.key}
                      className="h-full rounded-sm transition-all duration-300"
                      style={{ width: `${pct}%`, background: isOver ? "#f87171" : cat.color, opacity: isOver ? 0.7 : 1 }}
                    />
                  ) : null;
                })}
                {isOver && (
                  <div className="h-full rounded-sm" style={{ width: `${Math.min(100, (Math.abs(remaining) / maxCalls) * 100)}%`, background: "#f87171", opacity: 0.4 }} />
                )}
              </div>

              {/* Error message */}
              {isOver && (
                <p
                  className="text-[11px] mt-0.5"
                  style={{ color: "#f87171", fontFeatureSettings: FF }}
                  role="alert"
                >
                  Category totals exceed the per-user limit. Reduce categories or increase the total.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TeamPage() {
  const isSuperadmin = useAuthStore((s) => s.hasRole)("superadmin");
  const [tab, setTab] = useState<"team" | "users">("team");

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0" }}>
        {([
          { key: "team",  label: "Team Overview" },
          ...(isSuperadmin ? [{ key: "users", label: "User Registry" }] : []),
        ] as { key: "team" | "users"; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-4 py-3 text-[13px] relative"
            style={{
              color: tab === key ? "#f7f8f8" : "#62666d",
              fontWeight: tab === key ? 510 : 400,
              fontFeatureSettings: FF,
              background: "none",
              border: "none",
              borderBottom: tab === key ? "2px solid #7170ff" : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "team" && <TeamTab />}
      {tab === "users" && isSuperadmin && <UsersTab />}
    </div>
  );
}

function TeamTab() {
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
    <div className="flex flex-col gap-8">
      {/* Header */}
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

      {/* Summary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Reviewers",      value: data?.length ?? 0    },
          { label: "Total Assigned", value: totalAssigned        },
          { label: "Completed",      value: totalCompleted       },
          { label: "Pending",        value: totalPending         },
          { label: "Done Today",     value: completedToday       },
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
                  {s.value}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Main grid */}
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

      {/* Status banner */}
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
            { label: "Reviewers",  value: isLoading ? "—" : String(data?.length ?? 0) },
            { label: "Pending",    value: isLoading ? "—" : String(totalPending)       },
            { label: "Done Today", value: isLoading ? "—" : String(completedToday)     },
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

function UsersTab() {
  const { data, isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const isSuperadmin = useAuthStore((s) => s.hasRole)("superadmin");
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail]       = useState("");
  const [newName, setNewName]         = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole]         = useState<UserRole>("reviewer");

  const stats = useMemo(() => ({
    total:     data?.length ?? 0,
    active:    data?.filter((u) => u.is_active).length ?? 0,
    admins:    data?.filter((u) => u.role === "admin" || u.role === "superadmin").length ?? 0,
    reviewers: data?.filter((u) => u.role === "reviewer").length ?? 0,
  }), [data]);

  const handleCreate = async () => {
    if (!newEmail || !newName || !newPassword) return;
    try {
      await createUser.mutateAsync({ email: newEmail, name: newName, password: newPassword, role: newRole });
      toast.success(`User ${newName} created as ${newRole}`);
      setShowCreate(false);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewRole("reviewer");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Failed to create user");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1
            className="text-3xl tracking-tight"
            style={{ color: "#f7f8f8", fontWeight: 590, letterSpacing: "-0.704px", fontFeatureSettings: FF }}
          >
            User Registry
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#8a8f98", fontFeatureSettings: FF }}>
            Manage system accounts, roles, and access permissions.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm transition-all active:scale-95 border"
          style={
            showCreate
              ? { background: "rgba(255,255,255,0.02)", color: "#8a8f98", borderColor: "rgba(255,255,255,0.08)", fontWeight: 510, fontFeatureSettings: FF }
              : { background: "#5e6ad2", color: "#f7f8f8", borderColor: "transparent", fontWeight: 510, fontFeatureSettings: FF }
          }
          onMouseEnter={(e) => { if (!showCreate) (e.currentTarget as HTMLButtonElement).style.background = "#828fff"; }}
          onMouseLeave={(e) => { if (!showCreate) (e.currentTarget as HTMLButtonElement).style.background = "#5e6ad2"; }}
        >
          <UserPlus className="h-4 w-4" />
          {showCreate ? "Cancel" : "Add User"}
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: "Total Users", value: stats.total,     icon: <Users className="h-[18px] w-[18px]" style={{ color: "#62666d" }} /> },
          { label: "Active",      value: stats.active,    icon: <span className="material-symbols-outlined text-lg" style={{ color: "#10b981", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span> },
          { label: "Admins",      value: stats.admins,    icon: <ShieldCheck className="h-[18px] w-[18px]" style={{ color: "#eab308" }} /> },
          { label: "Reviewers",   value: stats.reviewers, icon: <Star className="h-[18px] w-[18px]" style={{ color: "#38bdf8" }} /> },
        ].map((s) => (
          <div
            key={s.label}
            className="relative overflow-hidden rounded-xl p-5 border"
            style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-2">
                <span
                  className="text-[10px] uppercase tracking-[0.05em]"
                  style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}
                >
                  {s.label}
                </span>
                {s.icon}
              </div>
              {isLoading ? (
                <Skeleton className="h-9 w-16 mt-1" style={{ background: "rgba(255,255,255,0.05)" }} />
              ) : (
                <span
                  className="text-3xl tracking-tight"
                  style={{ color: "#f7f8f8", fontWeight: 590, fontFeatureSettings: FF }}
                >
                  {s.value}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create user form */}
      {showCreate && (
        <div
          className="rounded-2xl p-8 animate-in slide-in-from-top-2 duration-200 border-l-2 border"
          style={{ background: "#191a1b", borderLeftColor: "#7170ff", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(113,112,255,0.1)" }}
            >
              <UserPlus className="h-4 w-4" style={{ color: "#7170ff" }} />
            </div>
            <h2
              className="text-sm uppercase tracking-widest"
              style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
            >
              New User
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
            {[
              { label: "Full Name", value: newName,     onChange: setNewName,     type: "text",     placeholder: "Jane Smith"          },
              { label: "Email",     value: newEmail,    onChange: setNewEmail,    type: "email",    placeholder: "jane@lokam.dev"      },
              { label: "Password",  value: newPassword, onChange: setNewPassword, type: "password", placeholder: "Temporary password"  },
            ].map(({ label, value, onChange, type, placeholder }) => (
              <div key={label} className="flex flex-col gap-2">
                <label
                  className="text-[10px] uppercase tracking-widest pl-1"
                  style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}
                >
                  {label}
                </label>
                <input
                  type={type}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={placeholder}
                  className="rounded-xl px-5 py-3 text-sm border transition-all focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.02)", color: "#d0d6e0", borderColor: "rgba(255,255,255,0.08)", fontFeatureSettings: FF }}
                  onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(113,112,255,0.4)"; }}
                  onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
                />
              </div>
            ))}

            <div className="flex flex-col gap-2">
              <label
                className="text-[10px] uppercase tracking-widest pl-1"
                style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}
              >
                Role
              </label>
              <div className="flex gap-2 h-[46px]">
                {(["reviewer", "admin", ...(isSuperadmin ? ["superadmin"] : [])] as UserRole[]).map((r) => {
                  const active = newRole === r;
                  const cfg = ROLE_CONFIG[r];
                  return (
                    <button
                      key={r}
                      onClick={() => setNewRole(r)}
                      className="flex-1 rounded-xl text-[10px] uppercase tracking-widest transition-all"
                      style={
                        active
                          ? { background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontWeight: 510, fontFeatureSettings: FF }
                          : { background: "rgba(255,255,255,0.02)", color: "#8a8f98", border: "1px solid rgba(255,255,255,0.08)", fontWeight: 510, fontFeatureSettings: FF }
                      }
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={!newEmail || !newName || !newPassword || createUser.isPending}
            className="px-8 py-3 rounded-xl text-sm transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: "#5e6ad2", color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
            onMouseEnter={(e) => { if (!createUser.isPending) (e.currentTarget as HTMLButtonElement).style.background = "#828fff"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#5e6ad2"; }}
          >
            {createUser.isPending ? "Creating…" : "Create User"}
          </button>
        </div>
      )}

      {/* Users table */}
      <div
        className="rounded-3xl overflow-hidden border"
        style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
      >
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {[
                { label: "User",   cls: "w-64" },
                { label: "Email",  cls: ""     },
                { label: "Role",   cls: "w-36" },
                { label: "Status", cls: "w-32" },
                { label: "",       cls: "w-32" },
              ].map(({ label, cls }) => (
                <th
                  key={label}
                  className={`px-6 py-5 text-[10px] uppercase tracking-[0.1em] ${cls} ${label === "" ? "text-right" : ""}`}
                  style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-9 h-9 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
                        <Skeleton className="h-4 w-28" style={{ background: "rgba(255,255,255,0.05)" }} />
                      </div>
                    </td>
                    <td className="px-6 py-5"><Skeleton className="h-4 w-44" style={{ background: "rgba(255,255,255,0.05)" }} /></td>
                    <td className="px-6 py-5"><Skeleton className="h-6 w-20 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} /></td>
                    <td className="px-6 py-5"><Skeleton className="h-4 w-16" style={{ background: "rgba(255,255,255,0.05)" }} /></td>
                    <td className="px-6 py-5 text-right"><Skeleton className="h-7 w-20 rounded-lg ml-auto" style={{ background: "rgba(255,255,255,0.05)" }} /></td>
                  </tr>
                ))
              : data?.map((u) => {
                  const role = ROLE_CONFIG[u.role] ?? ROLE_CONFIG.reviewer;
                  const initials = u.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

                  return (
                    <tr
                      key={u.id}
                      className="group transition-colors"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[10px] border"
                            style={{
                              background: "rgba(113,112,255,0.08)",
                              color: "#7170ff",
                              borderColor: "rgba(113,112,255,0.2)",
                              fontWeight: 510,
                              fontFeatureSettings: FF,
                            }}
                          >
                            {initials}
                          </div>
                          <span className="text-sm" style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}>
                            {u.name}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-5 text-sm" style={{ color: "#8a8f98", fontFamily: "Berkeley Mono, ui-monospace, monospace" }}>
                        {u.email}
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider border"
                          style={{ background: role.bg, color: role.color, borderColor: role.border, fontWeight: 510, fontFeatureSettings: FF }}
                        >
                          {role.label}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: u.is_active ? "#10b981" : "rgba(255,255,255,0.2)" }} />
                          <span
                            className="text-[10px] uppercase tracking-wider"
                            style={{ color: u.is_active ? "#10b981" : "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
                          >
                            {u.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Role selector — superadmin only, can't change own role */}
                          {isSuperadmin && u.role !== "superadmin" && (
                            <DropdownSelect
                              size="sm"
                              value={u.role}
                              options={[
                                { value: "reviewer", label: "Reviewer" },
                                { value: "admin",    label: "Admin" },
                              ]}
                              onChange={(newRole) => {
                                updateUser.mutate(
                                  { userId: u.id, patch: { role: newRole } },
                                  {
                                    onSuccess: () => toast.success(`${u.name} is now ${newRole}`),
                                    onError: () => toast.error("Failed to update role"),
                                  }
                                );
                              }}
                            />
                          )}

                          <button
                            disabled={updateUser.isPending}
                            onClick={() => {
                              updateUser.mutate(
                                { userId: u.id, patch: { is_active: !u.is_active } },
                                {
                                  onSuccess: () => toast.success(u.is_active ? `${u.name} deactivated` : `${u.name} activated`),
                                  onError: () => toast.error("Failed to update user"),
                                }
                              );
                            }}
                            className="px-4 py-1.5 rounded-lg text-xs border transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                            style={
                              u.is_active
                                ? { background: "rgba(255,255,255,0.02)", color: "#8a8f98", borderColor: "rgba(255,255,255,0.08)", fontWeight: 510, fontFeatureSettings: FF }
                                : { background: "rgba(113,112,255,0.08)", color: "#7170ff", borderColor: "rgba(113,112,255,0.2)", fontWeight: 510, fontFeatureSettings: FF }
                            }
                          >
                            {u.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>

        {!isLoading && (
          <div
            className="px-6 py-4 flex items-center justify-between border-t"
            style={{ background: "rgba(255,255,255,0.01)", borderColor: "rgba(255,255,255,0.06)" }}
          >
            <span className="text-xs" style={{ color: "#8a8f98", fontFeatureSettings: FF }}>
              {data?.length ?? 0} users in registry
            </span>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#10b981" }} />
              <span
                className="text-[10px] uppercase tracking-widest"
                style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
              >
                Registry Live
              </span>
            </div>
          </div>
        )}
      </div>

      <AssignmentConfigPanel />
    </div>
  );
}
