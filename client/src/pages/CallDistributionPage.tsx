import { useState, useEffect, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Sliders } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useBucketConfig, useUpdateBucketConfig, useReviewerCapacities, useBulkUpdateReviewerCapacities } from "@/hooks/use-bucket-config";
import { Skeleton } from "@/components/ui/skeleton";
import type { BucketProbabilities, SpecialTypeMinimums, ReviewerCapacity } from "@/types";

const FF = '"cv01", "ss03"' as const;

const NPS_BUCKET_GROUPS = [
  {
    label: "Service NPS",
    color: "#7170ff",
    keys: [
      { key: "service_na" as const,         label: "N/A"       },
      { key: "service_passive" as const,     label: "Passive"   },
      { key: "service_detractor" as const,   label: "Detractor" },
      { key: "service_promoter" as const,    label: "Promoter"  },
      { key: "service_missed" as const,      label: "Missed"    },
    ],
  },
  {
    label: "Sales NPS",
    color: "#10b981",
    keys: [
      { key: "sales_na" as const,            label: "N/A"       },
      { key: "sales_detractor" as const,     label: "Detractor" },
      { key: "sales_promoter" as const,      label: "Promoter"  },
    ],
  },
] as const;

const SPECIAL_ENTRIES = [
  { key: "dnc" as const,                 label: "DNC"              },
  { key: "email_send" as const,          label: "Email Send"       },
  { key: "lead_escalated" as const,      label: "Lead Escalated"   },
  { key: "review_link_sent" as const,    label: "Review Link Sent" },
  { key: "post_call_sms" as const,       label: "Post-call SMS"    },
] as const;

type NpsBucketKey = keyof BucketProbabilities;
type SpecialKey = keyof SpecialTypeMinimums;

const SUM_TOLERANCE = 0.001;

function probsToPercent(probs: BucketProbabilities): Record<NpsBucketKey, string> {
  return Object.fromEntries(
    Object.entries(probs).map(([k, v]) => [k, (v * 100).toFixed(2)])
  ) as Record<NpsBucketKey, string>;
}

function percentToProbs(pct: Record<NpsBucketKey, string>): BucketProbabilities {
  return Object.fromEntries(
    Object.entries(pct).map(([k, v]) => [k, parseFloat(v) / 100 || 0])
  ) as BucketProbabilities;
}

// ─── Special Type Minimums section (Phase 1) ────────────────────────────────

function SpecialMinimumsSection({
  initialMinimums,
  onSaved,
}: {
  initialMinimums: SpecialTypeMinimums;
  onSaved: () => void;
}) {
  const update = useUpdateBucketConfig();
  const [values, setValues] = useState<Record<SpecialKey, string>>(
    Object.fromEntries(Object.entries(initialMinimums).map(([k, v]) => [k, String(v)])) as Record<SpecialKey, string>
  );
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setValues(Object.fromEntries(Object.entries(initialMinimums).map(([k, v]) => [k, String(v)])) as Record<SpecialKey, string>);
    setDirty(false);
  }, [initialMinimums]);

  const handleSave = async () => {
    try {
      const special_minimums = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, Math.max(0, parseInt(v, 10) || 0)])
      ) as SpecialTypeMinimums;
      await update.mutateAsync({ special_minimums });
      toast.success("Special type minimums saved");
      setDirty(false);
      onSaved();
    } catch {
      toast.error("Failed to save special type minimums");
    }
  };

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between px-7 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(234,179,8,0.1)" }}>
            <Sliders className="h-[14px] w-[14px]" style={{ color: "#eab308" }} />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-[0.12em]" style={{ color: "#eab308", fontWeight: 510, fontFeatureSettings: FF }}>
              Phase 1 — Guaranteed Minimums
            </span>
            <h2 className="text-sm leading-none mt-0.5" style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}>
              Special Type Minimums
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <button
              onClick={handleSave}
              disabled={update.isPending}
              className="px-4 py-2 rounded-lg text-[11px] uppercase tracking-widest border transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: "#5e6ad2", color: "#f7f8f8", borderColor: "transparent", fontWeight: 510, fontFeatureSettings: FF }}
            >
              {update.isPending ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>

      <div className="px-7 py-6">
        <p className="text-[11px] mb-5" style={{ color: "#62666d", fontFeatureSettings: FF }}>
          Each day, at least this many calls of each special type are picked first (Phase 1). Set to 0 to skip a type.
        </p>
        <div className="flex flex-wrap gap-5">
          {SPECIAL_ENTRIES.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-[0.1em] pl-1" style={{ color: "#eab308", fontWeight: 510, fontFeatureSettings: FF, opacity: 0.8 }}>
                {label}
              </label>
              <input
                type="number"
                min={0}
                max={999}
                step={1}
                value={values[key] ?? "0"}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [key]: e.target.value }));
                  setDirty(true);
                }}
                className="rounded-xl px-4 py-3 text-sm border focus:outline-none w-[88px] font-mono"
                style={{
                  background: "rgba(234,179,8,0.04)",
                  color: "#eab308",
                  borderColor: "rgba(234,179,8,0.2)",
                  fontFeatureSettings: FF,
                  fontWeight: 510,
                }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(234,179,8,0.5)"; }}
                onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(234,179,8,0.2)"; }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── NPS Bucket Probabilities section (Phase 2) ──────────────────────────────

function ProbabilitySection({
  initialProbs,
  defaultCapacity,
  totalPool,
  sumSpecialMinimums,
  onSaved,
}: {
  initialProbs: BucketProbabilities;
  defaultCapacity: number;
  totalPool: number;
  sumSpecialMinimums: number;
  onSaved: () => void;
}) {
  const update = useUpdateBucketConfig();
  const [pct, setPct] = useState<Record<NpsBucketKey, string>>(probsToPercent(initialProbs));
  const [defaultCap, setDefaultCap] = useState(defaultCapacity);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setPct(probsToPercent(initialProbs));
    setDefaultCap(defaultCapacity);
    setDirty(false);
  }, [initialProbs, defaultCapacity]);

  const total = useMemo(
    () => Object.values(pct).reduce((s, v) => s + (parseFloat(v) || 0), 0),
    [pct]
  );
  const valid = Math.abs(total - 100) <= SUM_TOLERANCE * 100;
  const phase2Pool = Math.max(0, totalPool - sumSpecialMinimums);

  const handleSave = async () => {
    if (!valid) return;
    try {
      const probs = percentToProbs(pct);
      await update.mutateAsync({ probabilities: probs, default_reviewer_capacity: defaultCap });
      toast.success("Call distribution config saved");
      setDirty(false);
      onSaved();
    } catch {
      toast.error("Failed to save distribution config");
    }
  };

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: "#191a1b", borderColor: !valid && dirty ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.08)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-7 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(113,112,255,0.1)" }}>
            <Sliders className="h-[14px] w-[14px]" style={{ color: "#7170ff" }} />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-[0.12em]" style={{ color: "#7170ff", fontWeight: 510, fontFeatureSettings: FF }}>
              Phase 2 — NPS Distribution
            </span>
            <h2 className="text-sm leading-none mt-0.5" style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}>
              Bucket Probabilities
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-[11px] font-mono px-3 py-1 rounded-lg border"
            style={{
              color: valid ? "#10b981" : "#f87171",
              borderColor: valid ? "rgba(16,185,129,0.25)" : "rgba(248,113,113,0.25)",
              background: valid ? "rgba(16,185,129,0.06)" : "rgba(248,113,113,0.06)",
              fontFeatureSettings: FF,
            }}
            aria-live="polite"
          >
            Σ = {total.toFixed(2)}%
          </span>
          {dirty && !valid && (
            <span className="text-[11px]" style={{ color: "#f87171", fontFeatureSettings: FF }}>
              Must equal 100%
            </span>
          )}
          {dirty && (
            <button
              onClick={handleSave}
              disabled={update.isPending || !valid}
              className="px-4 py-2 rounded-lg text-[11px] uppercase tracking-widest border transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: valid ? "#5e6ad2" : "rgba(248,113,113,0.08)", color: valid ? "#f7f8f8" : "#f87171", borderColor: valid ? "transparent" : "rgba(248,113,113,0.2)", fontWeight: 510, fontFeatureSettings: FF }}
            >
              {update.isPending ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>

      {/* Default capacity row */}
      <div className="flex items-center gap-4 px-7 pt-6 pb-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "#eab308", fontWeight: 510, fontFeatureSettings: FF }}>
            Default Reviewer Capacity
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={defaultCap}
            onChange={(e) => { setDefaultCap(Math.max(1, Number(e.target.value))); setDirty(true); }}
            className="rounded-xl px-4 py-3 text-sm border focus:outline-none w-[96px] font-mono"
            style={{ background: "rgba(234,179,8,0.04)", color: "#eab308", borderColor: "rgba(234,179,8,0.2)", fontFeatureSettings: FF, fontWeight: 510 }}
            onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(234,179,8,0.5)"; }}
            onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(234,179,8,0.2)"; }}
          />
        </div>
        {totalPool > 0 && (
          <div className="mt-5 flex flex-col gap-0.5">
            <p className="text-[11px]" style={{ color: "#8a8f98", fontFeatureSettings: FF }}>
              Total pool: <span style={{ color: "#f7f8f8", fontWeight: 510 }}>{totalPool}</span> calls/day
            </p>
            <p className="text-[11px]" style={{ color: "#8a8f98", fontFeatureSettings: FF }}>
              Phase 2 remaining: <span style={{ color: "#7170ff", fontWeight: 510 }}>{phase2Pool}</span> after phase 1
            </p>
          </div>
        )}
      </div>

      {/* NPS bucket groups */}
      <div className="px-7 pb-7 pt-4 flex flex-col gap-6">
        {NPS_BUCKET_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-3">
            <h3 className="text-[10px] uppercase tracking-[0.12em]" style={{ color: group.color, fontWeight: 510, fontFeatureSettings: FF }}>
              {group.label}
            </h3>
            <div className="flex flex-wrap gap-3">
              {group.keys.map(({ key, label }) => {
                const v = pct[key] ?? "0";
                const derivedCount = phase2Pool > 0 ? Math.round(phase2Pool * (parseFloat(v) / 100)) : null;
                return (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase tracking-[0.1em] pl-1" style={{ color: group.color, fontWeight: 510, fontFeatureSettings: FF, opacity: 0.8 }}>
                      {label}
                    </label>
                    <div className="flex flex-col gap-0.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={v}
                        onChange={(e) => {
                          setPct((p) => ({ ...p, [key]: e.target.value }));
                          setDirty(true);
                        }}
                        className="rounded-xl px-4 py-3 text-sm border focus:outline-none w-[88px] font-mono"
                        style={{
                          background: `rgba(${group.color === "#7170ff" ? "113,112,255" : "16,185,129"},0.06)`,
                          color: group.color,
                          borderColor: `${group.color}33`,
                          fontFeatureSettings: FF,
                          fontWeight: 510,
                        }}
                        onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = `${group.color}80`; }}
                        onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = `${group.color}33`; }}
                      />
                      {derivedCount !== null && (
                        <span className="text-[10px] pl-1 font-mono" style={{ color: "#62666d", fontFeatureSettings: FF }}>
                          ~{derivedCount} calls
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Reviewer Capacity section ────────────────────────────────────────────────

function ReviewerCapacitySection({
  reviewers,
  defaultCapacity,
}: {
  reviewers: ReviewerCapacity[];
  defaultCapacity: number;
}) {
  const bulkUpdate = useBulkUpdateReviewerCapacities();
  const [overrides, setOverrides] = useState<Record<number, number | null>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setOverrides({});
    setDirty(false);
  }, [reviewers]);

  const handleChange = (userId: number, value: string) => {
    const parsed = value === "" ? null : parseInt(value, 10);
    setOverrides((o) => ({ ...o, [userId]: Number.isNaN(parsed as number) ? null : parsed }));
    setDirty(true);
  };

  const handleReset = (userId: number) => {
    setOverrides((o) => ({ ...o, [userId]: null }));
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      const allUpdates = Object.entries(overrides).map(([uid, cap]) => ({
        user_id: parseInt(uid, 10),
        capacity: cap,
      }));
      if (allUpdates.length === 0) return;
      await bulkUpdate.mutateAsync(allUpdates);
      toast.success("Reviewer capacities saved");
      setOverrides({});
      setDirty(false);
    } catch {
      toast.error("Failed to save reviewer capacities");
    }
  };

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between px-7 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div>
          <span className="text-[11px] uppercase tracking-[0.12em]" style={{ color: "#7170ff", fontWeight: 510, fontFeatureSettings: FF }}>
            Superadmin
          </span>
          <h2 className="text-sm leading-none mt-0.5" style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}>
            Reviewer Capacity
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <span className="text-[10px] uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#62666d", fontFeatureSettings: FF }}>
              <span className="w-1 h-1 rounded-full" style={{ background: "#eab308" }} />
              Unsaved
            </span>
          )}
          {dirty && (
            <button
              onClick={handleSave}
              disabled={bulkUpdate.isPending}
              className="px-4 py-2 rounded-lg text-[11px] uppercase tracking-widest border transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: "#5e6ad2", color: "#f7f8f8", borderColor: "transparent", fontWeight: 510, fontFeatureSettings: FF }}
            >
              {bulkUpdate.isPending ? "Saving…" : "Save changes"}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Name", "Email", "Capacity", "Effective", ""].map((h) => (
                <th key={h} className="px-7 py-3 text-left text-[10px] uppercase tracking-[0.1em]" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reviewers.map((r) => {
              const override = overrides[r.user_id];
              const displayValue = override !== undefined ? (override === null ? "" : String(override)) : (r.capacity === null ? "" : String(r.capacity));
              const effective = override !== undefined ? (override === null ? defaultCapacity : (override || defaultCapacity)) : r.effective_capacity;
              const isOverridden = (override !== undefined ? override !== null : r.capacity !== null);

              return (
                <tr key={r.user_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td className="px-7 py-3" style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}>
                    {r.name}
                  </td>
                  <td className="px-7 py-3 font-mono text-xs" style={{ color: "#8a8f98" }}>
                    {r.email}
                  </td>
                  <td className="px-7 py-3">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      placeholder={String(defaultCapacity)}
                      value={displayValue}
                      onChange={(e) => handleChange(r.user_id, e.target.value)}
                      className="rounded-lg px-3 py-2 text-xs border focus:outline-none w-[72px] font-mono"
                      style={{
                        background: isOverridden ? "rgba(113,112,255,0.06)" : "rgba(255,255,255,0.04)",
                        color: isOverridden ? "#7170ff" : "#8a8f98",
                        borderColor: isOverridden ? "rgba(113,112,255,0.3)" : "rgba(255,255,255,0.08)",
                        fontFeatureSettings: FF,
                      }}
                    />
                  </td>
                  <td className="px-7 py-3 font-mono text-xs" style={{ color: "#eab308" }}>
                    {effective}
                  </td>
                  <td className="px-7 py-3">
                    {isOverridden && (
                      <button
                        onClick={() => handleReset(r.user_id)}
                        className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-lg border"
                        style={{ color: "#8a8f98", borderColor: "rgba(255,255,255,0.08)", background: "transparent", fontFeatureSettings: FF }}
                      >
                        Reset
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CallDistributionPage() {
  const isSuperadmin = useAuthStore((s) => s.hasRole("superadmin"));
  if (!isSuperadmin) return <Navigate to="/dashboard" replace />;

  const { data: cfg, isLoading: cfgLoading } = useBucketConfig();
  const { data: reviewers = [], isLoading: revLoading } = useReviewerCapacities();
  const [refreshKey, setRefreshKey] = useState(0);

  const totalPool = useMemo(
    () => reviewers.reduce((s, r) => s + r.effective_capacity, 0),
    [reviewers]
  );

  const sumSpecialMinimums = useMemo(() => {
    if (!cfg) return 0;
    return Object.values(cfg.special_minimums).reduce((s, v) => s + v, 0);
  }, [cfg]);

  if (cfgLoading || revLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <Skeleton className="h-10 w-48 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }} />
        <Skeleton className="h-40 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }} />
        <Skeleton className="h-64 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }} />
        <Skeleton className="h-48 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }} />
      </div>
    );
  }

  return (
    <div key={refreshKey} className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-xl" style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}>
          Call Distribution Config
        </h1>
        <p className="text-sm mt-1" style={{ color: "#62666d", fontFeatureSettings: FF }}>
          Phase 1 picks guaranteed special-type minimums first; Phase 2 fills remaining slots with NPS bucket probabilities.
        </p>
      </div>

      {cfg && (
        <SpecialMinimumsSection
          initialMinimums={cfg.special_minimums}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {cfg && (
        <ProbabilitySection
          initialProbs={cfg.probabilities}
          defaultCapacity={cfg.default_reviewer_capacity}
          totalPool={totalPool}
          sumSpecialMinimums={sumSpecialMinimums}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      )}

      <ReviewerCapacitySection
        reviewers={reviewers}
        defaultCapacity={cfg?.default_reviewer_capacity ?? 17}
      />
    </div>
  );
}
