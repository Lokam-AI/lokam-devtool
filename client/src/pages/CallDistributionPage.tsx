import { useState, useEffect, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { SlidersHorizontal } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useBucketConfig, useUpdateBucketConfig, useReviewerCapacities, useBulkUpdateReviewerCapacities } from "@/hooks/use-bucket-config";
import { Skeleton } from "@/components/ui/skeleton";
import type { BucketProbabilities, BucketConfigSystemDefaults, SpecialTypeMinimums, ReviewerCapacity } from "@/types";

const FF = '"cv01", "ss03"' as const;

type NpsBucketKey = keyof BucketProbabilities;
type SpecialKey = keyof SpecialTypeMinimums;

type CatConfig = { key: NpsBucketKey; label: string; color: string; bg: string; border: string };
type SpecialCatConfig = { key: SpecialKey; label: string; color: string; bg: string; border: string };

const SERVICE_CATS: CatConfig[] = [
  { key: "service_na",        label: "N/A",       color: "#7170ff", bg: "rgba(113,112,255,0.08)", border: "rgba(113,112,255,0.2)"  },
  { key: "service_passive",   label: "Passive",   color: "#eab308", bg: "rgba(234,179,8,0.08)",   border: "rgba(234,179,8,0.2)"    },
  { key: "service_detractor", label: "Detractor", color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)"  },
  { key: "service_promoter",  label: "Promoter",  color: "#10b981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.2)"   },
  { key: "service_missed",    label: "Missed",    color: "#8a8f98", bg: "rgba(138,143,152,0.08)", border: "rgba(138,143,152,0.15)" },
];

const SALES_CATS: CatConfig[] = [
  { key: "sales_na",        label: "N/A",       color: "#7170ff", bg: "rgba(113,112,255,0.08)", border: "rgba(113,112,255,0.2)" },
  { key: "sales_detractor", label: "Detractor", color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
  { key: "sales_promoter",  label: "Promoter",  color: "#10b981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.2)"  },
];

const SPECIAL_CATS: SpecialCatConfig[] = [
  { key: "dnc",              label: "DNC",              color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
  { key: "email_send",       label: "Email Send",       color: "#38bdf8", bg: "rgba(56,189,248,0.08)",  border: "rgba(56,189,248,0.2)"  },
  { key: "lead_escalated",   label: "Lead Escalated",   color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.2)" },
  { key: "review_link_sent", label: "Review Link",      color: "#fb923c", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.2)"  },
  { key: "post_call_sms",    label: "Post-call SMS",    color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.2)"  },
];

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

// ─── Segmented bar ────────────────────────────────────────────────────────────
function SegmentedBar({
  segments,
  isOver = false,
}: {
  segments: { color: string; pct: number }[];
  isOver?: boolean;
}) {
  const totalPct = segments.reduce((s, seg) => s + seg.pct, 0);
  return (
    <div className="h-1.5 rounded-full overflow-hidden flex gap-px" style={{ background: "rgba(255,255,255,0.05)" }}>
      {segments.map((seg, i) =>
        seg.pct > 0 ? (
          <div
            key={i}
            className="h-full rounded-sm transition-all duration-300"
            style={{ width: `${seg.pct}%`, background: isOver ? "#f87171" : seg.color, opacity: isOver ? 0.7 : 1 }}
          />
        ) : null
      )}
      {totalPct < 99.9 && (
        <div className="h-full flex-1 rounded-sm" style={{ background: "rgba(255,255,255,0.04)" }} />
      )}
    </div>
  );
}

// ─── Avatar initials ──────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const hue = [...name].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] shrink-0 border"
      style={{
        background: `hsla(${hue},40%,40%,0.15)`,
        color: `hsl(${hue},60%,75%)`,
        borderColor: `hsla(${hue},40%,55%,0.25)`,
        fontWeight: 510,
        fontFeatureSettings: FF,
      }}
    >
      {initials}
    </div>
  );
}

// ─── Unsaved indicator + Save button (shared pattern) ─────────────────────────
function PanelActions({
  dirty,
  isPending,
  disabled = false,
  onSave,
  saveLabel = "Save",
}: {
  dirty: boolean;
  isPending: boolean;
  disabled?: boolean;
  onSave: () => void;
  saveLabel?: string;
}) {
  if (!dirty) return null;
  return (
    <>
      {!isPending && (
        <span className="text-[10px] uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#62666d", fontFeatureSettings: FF }}>
          <span className="w-1 h-1 rounded-full" style={{ background: "#eab308" }} />
          Unsaved
        </span>
      )}
      <button
        onClick={onSave}
        disabled={isPending || disabled}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] uppercase tracking-widest border cursor-pointer transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
        style={{
          background: disabled ? "rgba(248,113,113,0.08)" : "#5e6ad2",
          color: disabled ? "#f87171" : "#f7f8f8",
          borderColor: disabled ? "rgba(248,113,113,0.2)" : "transparent",
          fontWeight: 510,
          fontFeatureSettings: FF,
        }}
        onMouseEnter={(e) => { if (!disabled && !isPending) (e.currentTarget as HTMLButtonElement).style.background = "#828fff"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = disabled ? "rgba(248,113,113,0.08)" : "#5e6ad2"; }}
      >
        {isPending ? "Saving…" : disabled ? "Fix errors" : saveLabel}
      </button>
    </>
  );
}

// ─── Special Type Minimums section (Phase 1) ──────────────────────────────────
function SpecialMinimumsSection({
  initialMinimums,
  systemDefaults,
  totalPool,
  onSaved,
}: {
  initialMinimums: SpecialTypeMinimums;
  systemDefaults: BucketConfigSystemDefaults;
  totalPool: number;
  onSaved: () => void;
}) {
  const update = useUpdateBucketConfig();
  const [values, setValues] = useState<Record<SpecialKey, string>>(
    Object.fromEntries(Object.entries(initialMinimums).map(([k, v]) => [k, String(v)])) as Record<SpecialKey, string>
  );

  useEffect(() => {
    setValues(Object.fromEntries(Object.entries(initialMinimums).map(([k, v]) => [k, String(v)])) as Record<SpecialKey, string>);
  }, [initialMinimums]);

  const dirty = useMemo(
    () => SPECIAL_CATS.some(cat => (parseInt(values[cat.key], 10) || 0) !== initialMinimums[cat.key]),
    [values, initialMinimums]
  );

  const totalPicks = useMemo(
    () => SPECIAL_CATS.reduce((s, cat) => s + (parseInt(values[cat.key], 10) || 0), 0),
    [values]
  );
  const isExceeded = totalPool > 0 && totalPicks > totalPool;

  const handleSave = async () => {
    try {
      const special_minimums = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, Math.max(0, parseInt(v, 10) || 0)])
      ) as SpecialTypeMinimums;
      await update.mutateAsync({ special_minimums });
      toast.success("Special type minimums saved");
      onSaved();
    } catch {
      toast.error("Failed to save special type minimums");
    }
  };

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)", transition: "border-color 200ms" }}
    >
      <div className="flex items-center justify-between px-7 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(234,179,8,0.1)" }}>
            <SlidersHorizontal className="h-[14px] w-[14px]" style={{ color: "#eab308" }} />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-[0.12em]" style={{ color: "#eab308", fontWeight: 510, fontFeatureSettings: FF }}>
              Priority Minimums
            </span>
            <h2 className="text-sm leading-none mt-0.5" style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}>
              Special Type Minimums
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setValues(Object.fromEntries(Object.entries(systemDefaults.special_minimums).map(([k, v]) => [k, String(v)])) as Record<SpecialKey, string>)}
            className="text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg border cursor-pointer transition-all"
            style={{ color: "#62666d", borderColor: "rgba(255,255,255,0.08)", background: "transparent", fontFeatureSettings: FF }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "#8a8f98"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#62666d"; }}
          >
            Reset defaults
          </button>
          <PanelActions dirty={dirty} isPending={update.isPending} disabled={isExceeded} onSave={handleSave} />
        </div>
      </div>

      <div className="px-7 py-6 flex flex-col gap-5">
        {/* Horizontal input row with + separators */}
        <div className="flex flex-wrap gap-3 items-start">
          {SPECIAL_CATS.map((cat, i) => (
            <div key={cat.key} className="flex items-start gap-3">
              <div className="flex flex-col gap-2 w-[84px]">
                <label className="text-[10px] uppercase tracking-[0.1em] pl-1 whitespace-nowrap" style={{ color: cat.color, fontWeight: 510, fontFeatureSettings: FF, opacity: 0.8 }}>
                  {cat.label}
                </label>
                <input
                  type="number"
                  min={0}
                  max={999}
                  step={1}
                  value={values[cat.key] ?? "0"}
                  onChange={(e) => setValues((v) => ({ ...v, [cat.key]: e.target.value }))}
                  className="rounded-xl px-4 py-3 text-sm border focus:outline-none w-[84px] font-mono"
                  style={{ background: cat.bg, color: cat.color, borderColor: cat.border, fontFeatureSettings: FF, fontWeight: 510 }}
                  onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = cat.color + "80"; }}
                  onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = cat.border; }}
                />
              </div>
              {i < SPECIAL_CATS.length - 1 && (
                <div className="mt-[35px] flex items-center">
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.15)" }}>+</span>
                </div>
              )}
            </div>
          ))}
          {/* = Total box */}
          <div className="flex items-start gap-3">
            <div className="mt-[35px] flex items-center">
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.15)" }}>=</span>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-[0.1em] pl-1" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>
                Total
              </label>
              <div
                className="rounded-xl px-4 py-3 text-sm border w-[84px] font-mono text-center"
                style={{
                  background: isExceeded ? "rgba(248,113,113,0.06)" : "rgba(234,179,8,0.04)",
                  color: isExceeded ? "#f87171" : "#eab308",
                  borderColor: isExceeded ? "rgba(248,113,113,0.3)" : "rgba(234,179,8,0.2)",
                  fontFeatureSettings: FF, fontWeight: 510,
                }}
              >
                {totalPicks}
              </div>
            </div>
          </div>
        </div>

        {/* Budget bar */}
        <div className="flex flex-col gap-2">
          <SegmentedBar
            isOver={isExceeded}
            segments={SPECIAL_CATS.map((cat) => ({
              color: cat.color,
              pct: totalPicks > 0 ? ((parseInt(values[cat.key], 10) || 0) / totalPicks) * 100 : 0,
            }))}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>
              Budget used
            </span>
            <span className="text-[11px] font-mono" style={{ color: isExceeded ? "#f87171" : totalPicks > 0 ? "#eab308" : "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>
              {totalPicks > 0 ? `${totalPicks} · target` : "0 · no minimums set"}
            </span>
          </div>
          {isExceeded && (
            <p className="text-[11px]" style={{ color: "#f87171", fontFeatureSettings: FF }} role="alert">
              Exceeds pool of {totalPool} calls/day — reduce minimums or increase reviewer capacity.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── NPS bucket group (horizontal row + bar) ──────────────────────────────────
function NpsGroup({
  label,
  color,
  cats,
  pct,
  phase2Pool,
  onChange,
}: {
  label: string;
  color: string;
  cats: CatConfig[];
  pct: Record<NpsBucketKey, string>;
  phase2Pool: number;
  onChange: (key: NpsBucketKey, value: string) => void;
}) {
  const groupTotal = cats.reduce((s, cat) => s + (parseFloat(pct[cat.key]) || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-[10px] uppercase tracking-[0.12em]" style={{ color, fontWeight: 510, fontFeatureSettings: FF }}>
        {label}
      </h3>
      {/* Horizontal input row */}
      <div className="flex flex-wrap gap-3 items-start">
        {cats.map((cat, i) => {
          const v = pct[cat.key] ?? "0";
          const derivedCount = phase2Pool > 0 ? Math.round(phase2Pool * (parseFloat(v) / 100)) : null;
          return (
            <div key={cat.key} className="flex items-start gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-[0.1em] pl-1" style={{ color: cat.color, fontWeight: 510, fontFeatureSettings: FF, opacity: 0.8 }}>
                  {cat.label}
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={v}
                  onChange={(e) => onChange(cat.key, e.target.value)}
                  className="rounded-xl px-4 py-3 text-sm border focus:outline-none w-[96px] font-mono"
                  style={{ background: cat.bg, color: cat.color, borderColor: cat.border, fontFeatureSettings: FF, fontWeight: 510 }}
                  onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = cat.color + "80"; }}
                  onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = cat.border; }}
                />
                {derivedCount !== null && (
                  <span className="text-[10px] pl-1 font-mono" style={{ color: "#62666d", fontFeatureSettings: FF }}>
                    ~{derivedCount} calls
                  </span>
                )}
              </div>
              {i < cats.length - 1 && (
                <div className="mt-[35px] flex items-center">
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.15)" }}>+</span>
                </div>
              )}
            </div>
          );
        })}
        {/* Group sub-total = box */}
        <div className="flex items-start gap-3">
          <div className="mt-[35px] flex items-center">
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.15)" }}>=</span>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-[0.1em] pl-1" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>
              Total
            </label>
            <div
              className="rounded-xl px-4 py-3 text-sm border w-[96px] font-mono text-center"
              style={{ background: "rgba(255,255,255,0.04)", color: groupTotal > 0 ? color : "#62666d", borderColor: "rgba(255,255,255,0.08)", fontFeatureSettings: FF, fontWeight: 510 }}
            >
              {groupTotal.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── NPS Bucket Probabilities section (Phase 2) ───────────────────────────────
function ProbabilitySection({
  initialProbs,
  defaultCapacity,
  systemDefaults,
  reviewers,
  onSaved,
}: {
  initialProbs: BucketProbabilities;
  defaultCapacity: number;
  systemDefaults: BucketConfigSystemDefaults;
  reviewers: ReviewerCapacity[];
  onSaved: () => void;
}) {
  const update = useUpdateBucketConfig();
  const [pct, setPct] = useState<Record<NpsBucketKey, string>>(probsToPercent(initialProbs));
  const [defaultCap, setDefaultCap] = useState(defaultCapacity);

  useEffect(() => {
    setPct(probsToPercent(initialProbs));
    setDefaultCap(defaultCapacity);
  }, [initialProbs, defaultCapacity]);

  const dirty = useMemo(() => {
    if (defaultCap !== defaultCapacity) return true;
    const initialPct = probsToPercent(initialProbs);
    return Object.keys(pct).some(
      (k) => (parseFloat(pct[k as NpsBucketKey]) || 0) !== (parseFloat(initialPct[k as NpsBucketKey]) || 0)
    );
  }, [pct, defaultCap, initialProbs, defaultCapacity]);

  const total = useMemo(
    () => Object.values(pct).reduce((s, v) => s + (parseFloat(v) || 0), 0),
    [pct]
  );
  const valid = Math.abs(total - 100) <= SUM_TOLERANCE * 100;
  const isOver = total > 100 + SUM_TOLERANCE * 100;

  const reviewerCount = reviewers.length;
  const exceeded = useMemo(
    () => reviewers.reduce((s, r) => s + (r.capacity !== null && r.capacity > defaultCap ? r.capacity - defaultCap : 0), 0),
    [reviewers, defaultCap]
  );
  const reduced = useMemo(
    () => reviewers.reduce((s, r) => s + (r.capacity !== null && r.capacity < defaultCap ? defaultCap - r.capacity : 0), 0),
    [reviewers, defaultCap]
  );
  const phase2Pool = reviewerCount > 0 ? defaultCap * reviewerCount + exceeded - reduced : 0;

  const handleChange = (key: NpsBucketKey, value: string) => {
    setPct((p) => ({ ...p, [key]: value }));
  };

  const handleSave = async () => {
    if (!valid) return;
    try {
      const probs = percentToProbs(pct);
      await update.mutateAsync({ probabilities: probs, default_reviewer_capacity: defaultCap });
      toast.success("Call distribution config saved");
      onSaved();
    } catch {
      toast.error("Failed to save distribution config");
    }
  };

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: "#191a1b", borderColor: !valid && dirty ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.08)", transition: "border-color 200ms" }}
    >
      <div className="flex items-center justify-between px-7 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(113,112,255,0.1)" }}>
            <SlidersHorizontal className="h-[14px] w-[14px]" style={{ color: "#7170ff" }} />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-[0.12em]" style={{ color: "#7170ff", fontWeight: 510, fontFeatureSettings: FF }}>
              NPS Distribution
            </span>
            <h2 className="text-sm leading-none mt-0.5" style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}>
              Bucket Probabilities
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setPct(probsToPercent(systemDefaults.probabilities)); setDefaultCap(systemDefaults.reviewer_capacity); }}
            className="text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg border cursor-pointer transition-all"
            style={{ color: "#62666d", borderColor: "rgba(255,255,255,0.08)", background: "transparent", fontFeatureSettings: FF }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "#8a8f98"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#62666d"; }}
          >
            Reset defaults
          </button>
          <PanelActions dirty={dirty} isPending={update.isPending} disabled={!valid} onSave={handleSave} />
        </div>
      </div>

      <div className="px-7 py-6 flex flex-col gap-6">
        {/* Default capacity formula row */}
        <div className="flex flex-wrap gap-3 items-start">
          {/* Default / User — editable */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-[0.1em] pl-1" style={{ color: "#eab308", fontWeight: 510, fontFeatureSettings: FF }}>
              Default / User
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={defaultCap}
              onChange={(e) => setDefaultCap(Math.max(1, Number(e.target.value)))}
              className="rounded-xl px-4 py-3 text-sm border focus:outline-none w-[96px] font-mono"
              style={{ background: "rgba(234,179,8,0.04)", color: "#eab308", borderColor: "rgba(234,179,8,0.2)", fontFeatureSettings: FF, fontWeight: 510 }}
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(234,179,8,0.5)"; }}
              onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "rgba(234,179,8,0.2)"; }}
            />
          </div>
          {reviewerCount > 0 && (
            <>
              {/* × No. of Users */}
              <div className="mt-[35px] flex items-center">
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>×</span>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-[0.1em] pl-1" style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}>
                  No. of Users
                </label>
                <div
                  className="rounded-xl px-4 py-3 text-sm border w-[96px] font-mono text-center"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#8a8f98", borderColor: "rgba(255,255,255,0.08)", fontFeatureSettings: FF, fontWeight: 510 }}
                >
                  {reviewerCount}
                </div>
              </div>
              {/* + Surplus (reviewers above default, always shown) */}
              <div className="mt-[35px] flex items-center">
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>+</span>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-[0.1em] pl-1" style={{ color: "#10b981", fontWeight: 510, fontFeatureSettings: FF, opacity: 0.8 }}>
                  Surplus
                </label>
                <div
                  className="rounded-xl px-4 py-3 text-sm border w-[96px] font-mono text-center"
                  style={{ background: "rgba(16,185,129,0.06)", color: "#10b981", borderColor: "rgba(16,185,129,0.2)", fontFeatureSettings: FF, fontWeight: 510 }}
                >
                  {exceeded}
                </div>
              </div>
              {/* − Shortfall (reviewers below default, always shown) */}
              <div className="mt-[35px] flex items-center">
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>−</span>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-[0.1em] pl-1" style={{ color: "#f87171", fontWeight: 510, fontFeatureSettings: FF, opacity: 0.8 }}>
                  Shortfall
                </label>
                <div
                  className="rounded-xl px-4 py-3 text-sm border w-[96px] font-mono text-center"
                  style={{ background: "rgba(248,113,113,0.06)", color: "#f87171", borderColor: "rgba(248,113,113,0.2)", fontFeatureSettings: FF, fontWeight: 510 }}
                >
                  {reduced}
                </div>
              </div>
              {/* = Total Pool / Day */}
              <div className="mt-[35px] flex items-center">
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>=</span>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-[0.1em] pl-1" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>
                  Total Pool / Day
                </label>
                <div
                  className="rounded-xl px-4 py-3 text-sm border w-[96px] font-mono text-center"
                  style={{ background: "rgba(234,179,8,0.04)", color: "#eab308", borderColor: "rgba(234,179,8,0.2)", fontFeatureSettings: FF, fontWeight: 510 }}
                >
                  {phase2Pool}
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }} />

        <NpsGroup label="Service NPS" color="#7170ff" cats={SERVICE_CATS} pct={pct} phase2Pool={phase2Pool} onChange={handleChange} />

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }} />

        <NpsGroup label="Sales NPS" color="#10b981" cats={SALES_CATS} pct={pct} phase2Pool={phase2Pool} onChange={handleChange} />

        {/* Unified distribution bar — all 8 NPS buckets in one line */}
        {(() => {
          const serviceTotal = SERVICE_CATS.reduce((s, cat) => s + (parseFloat(pct[cat.key]) || 0), 0);
          const salesTotal = SALES_CATS.reduce((s, cat) => s + (parseFloat(pct[cat.key]) || 0), 0);
          return (
            <div className="flex flex-col gap-2">
              <div className="h-1.5 rounded-full overflow-hidden flex gap-px" style={{ background: "rgba(255,255,255,0.05)" }}>
                {SERVICE_CATS.map((cat) => {
                  const p = parseFloat(pct[cat.key]) || 0;
                  return p > 0 ? (
                    <div key={cat.key} className="h-full rounded-sm transition-all duration-300"
                      style={{ width: `${p}%`, background: isOver ? "#f87171" : cat.color }} />
                  ) : null;
                })}
                <div className="h-full w-[2px] shrink-0" style={{ background: "rgba(255,255,255,0.18)" }} />
                {SALES_CATS.map((cat) => {
                  const p = parseFloat(pct[cat.key]) || 0;
                  return p > 0 ? (
                    <div key={cat.key} className="h-full rounded-sm transition-all duration-300"
                      style={{ width: `${p}%`, background: isOver ? "#f87171" : cat.color }} />
                  ) : null;
                })}
                {total < 99.9 && <div className="h-full flex-1 rounded-sm" style={{ background: "rgba(255,255,255,0.04)" }} />}
              </div>
              {/* Proportional region labels — width mirrors bar regions */}
              <div className="flex" style={{ gap: "2px" }}>
                <div className="flex flex-col gap-1 overflow-hidden" style={{ width: `${serviceTotal}%`, minWidth: 0 }}>
                  <div className="h-px rounded-full" style={{ background: "rgba(113,112,255,0.35)" }} />
                  <span className="text-[9px] uppercase tracking-[0.08em] truncate" style={{ color: "#7170ff", fontWeight: 510, fontFeatureSettings: FF }}>
                    Service · {serviceTotal.toFixed(1)}%
                  </span>
                </div>
                <div className="flex flex-col gap-1 overflow-hidden" style={{ width: `${salesTotal}%`, minWidth: 0 }}>
                  <div className="h-px rounded-full" style={{ background: "rgba(16,185,129,0.35)" }} />
                  <span className="text-[9px] uppercase tracking-[0.08em] truncate" style={{ color: "#10b981", fontWeight: 510, fontFeatureSettings: FF }}>
                    Sales · {salesTotal.toFixed(1)}%
                  </span>
                </div>
                {total < 99.9 && <div className="flex-1" />}
              </div>
            </div>
          );
        })()}

        {dirty && !valid && (
          <p className="text-[11px]" style={{ color: "#f87171", fontFeatureSettings: FF }} role="alert">
            All bucket probabilities must sum to exactly 100%.{" "}
            {isOver ? `Currently ${(total - 100).toFixed(2)}% over.` : `Currently ${(100 - total).toFixed(2)}% under.`}
          </p>
        )}
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
  const [overrides, setOverrides] = useState<Record<number, string>>({});

  useEffect(() => {
    setOverrides({});
  }, [reviewers]);

  const dirty = useMemo(
    () => Object.entries(overrides).some(([uid, str]) => {
      const r = reviewers.find((r) => r.user_id === parseInt(uid, 10));
      if (!r) return false;
      const newCap = str === "" ? null : (parseInt(str, 10) || null);
      return newCap !== r.capacity;
    }),
    [overrides, reviewers]
  );

  const handleChange = (userId: number, value: string) => {
    if (value !== "" && !/^\d+$/.test(value)) return;
    setOverrides((o) => ({ ...o, [userId]: value }));
  };

  const handleReset = (userId: number) => {
    setOverrides((o) => ({ ...o, [userId]: "" }));
  };

  const handleResetAll = () => {
    const all: Record<number, string> = {};
    reviewers.forEach((r) => { all[r.user_id] = ""; });
    setOverrides(all);
  };

  const handleSave = async () => {
    try {
      const allUpdates = Object.entries(overrides).map(([uid, str]) => ({
        user_id: parseInt(uid, 10),
        capacity: str === "" ? null : (parseInt(str, 10) || null),
      }));
      if (allUpdates.length === 0) return;
      await bulkUpdate.mutateAsync(allUpdates);
      toast.success("Reviewer capacities saved");
      setOverrides({});
    } catch {
      toast.error("Failed to save reviewer capacities");
    }
  };

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between px-7 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(113,112,255,0.1)" }}>
            <SlidersHorizontal className="h-[14px] w-[14px]" style={{ color: "#7170ff" }} />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-[0.12em]" style={{ color: "#7170ff", fontWeight: 510, fontFeatureSettings: FF }}>
              Superadmin
            </span>
            <h2 className="text-sm leading-none mt-0.5" style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}>
              Reviewer Capacity
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleResetAll}
            className="text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg border cursor-pointer transition-all"
            style={{ color: "#62666d", borderColor: "rgba(255,255,255,0.08)", background: "transparent", fontFeatureSettings: FF }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "#8a8f98"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#62666d"; }}
          >
            Reset all
          </button>
          <PanelActions dirty={dirty} isPending={bulkUpdate.isPending} onSave={handleSave} saveLabel="Save changes" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Reviewer", "Email", "Capacity", "Effective", ""].map((h) => (
                <th key={h} className="px-7 py-4 text-left text-[10px] uppercase tracking-[0.1em]" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reviewers.map((r) => {
              const rawStr = overrides[r.user_id];
              const displayValue = rawStr !== undefined ? rawStr : (r.capacity === null ? "" : String(r.capacity));
              const parsedOverride = rawStr !== undefined ? (rawStr === "" ? null : parseInt(rawStr, 10) || null) : undefined;
              const effective = parsedOverride !== undefined ? (parsedOverride === null ? defaultCapacity : parsedOverride) : r.effective_capacity;
              const resolvedCap = parsedOverride !== undefined ? parsedOverride : r.capacity;
              const isOverridden = resolvedCap !== null;

              return (
                <tr
                  key={r.user_id}
                  className="group transition-colors"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                >
                  <td className="px-7 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.name} />
                      <span style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}>{r.name}</span>
                    </div>
                  </td>
                  <td className="px-7 py-4 font-mono text-xs" style={{ color: "#8a8f98" }}>
                    {r.email}
                  </td>
                  <td className="px-7 py-4">
                    <input
                      type="text"
                      inputMode="numeric"
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
                      onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(113,112,255,0.6)"; }}
                      onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = isOverridden ? "rgba(113,112,255,0.3)" : "rgba(255,255,255,0.08)"; }}
                    />
                  </td>
                  <td className="px-7 py-4 font-mono text-xs" style={{ color: "#eab308", fontWeight: 510 }}>
                    {effective}
                  </td>
                  <td className="px-7 py-4">
                    {isOverridden && (
                      <button
                        onClick={() => handleReset(r.user_id)}
                        className="text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg border cursor-pointer transition-all opacity-0 group-hover:opacity-100"
                        style={{ color: "#8a8f98", borderColor: "rgba(255,255,255,0.08)", background: "transparent", fontFeatureSettings: FF }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "#f7f8f8"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#8a8f98"; }}
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
        <div
          className="px-7 py-4 flex items-center justify-between border-t"
          style={{ background: "rgba(255,255,255,0.01)", borderColor: "rgba(255,255,255,0.06)" }}
        >
          <span className="text-xs" style={{ color: "#8a8f98", fontFeatureSettings: FF }}>
            {reviewers.length} reviewer{reviewers.length !== 1 ? "s" : ""} in pool
          </span>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#10b981" }} />
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>
              Live
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
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

  if (cfgLoading || revLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <Skeleton className="h-10 w-48 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }} />
        <Skeleton className="h-44 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }} />
        <Skeleton className="h-80 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }} />
        <Skeleton className="h-52 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }} />
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
          Calls are distributed across NPS buckets by probability. Within each bucket, calls satisfying special type minimums are picked first.
        </p>
      </div>

      {cfg && (
        <ProbabilitySection
          initialProbs={cfg.probabilities}
          defaultCapacity={cfg.default_reviewer_capacity}
          systemDefaults={cfg.system_defaults}
          reviewers={reviewers}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {cfg && (
        <SpecialMinimumsSection
          initialMinimums={cfg.special_minimums}
          systemDefaults={cfg.system_defaults}
          totalPool={totalPool}
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
