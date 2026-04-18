import { useState, useEffect } from "react";
import { useHealth } from "@/hooks/use-calls";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { toast } from "sonner";
import type { Environment, EnvConfig } from "@/types";
import api, { apiGetEnvs } from "@/lib/api";

const FF = '"cv01", "ss03"' as const;

const SEED_MODES = [
  { value: "--check-and-seed", label: "Check & Seed" },
  { value: "--seed-only",      label: "Seed Only"    },
  { value: "--check-only",     label: "Check Only"   },
];

const WAVEFORM_HEIGHTS = [4, 6, 4, 6, 8, 6, 4, 6, 4, 12, 6, 4, 8, 5, 4, 7];

export default function AdminPage() {
  const [envs, setEnvs]                       = useState<EnvConfig[]>([]);
  const [env, setEnv]                         = useState<Environment>("");
  const [showAcsConfirm, setShowAcsConfirm]   = useState(false);
  const [seedMode, setSeedMode]               = useState("--check-and-seed");
  const [seedOrg, setSeedOrg]                 = useState("");
  const [seedRooftops, setSeedRooftops]       = useState("");
  const [seedRunning, setSeedRunning]         = useState(false);
  const { data: health, isLoading }           = useHealth();

  useEffect(() => {
    apiGetEnvs().then((data) => {
      setEnvs(data);
      if (data.length > 0) setEnv(data[0].name);
    }).catch(() => {});
  }, []);

  const handleAcsDisable = async () => {
    try {
      await api.post(`/admin/envs/${env}/acs`, { enabled: false });
      toast.success(`ACS disabled on ${env}`);
    } catch {
      toast.error("Failed to disable ACS");
    }
  };

  const handleRunSeed = async () => {
    const rooftopList = seedRooftops.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!seedOrg.trim() || rooftopList.length === 0) {
      toast.error("Organization name and at least one rooftop are required");
      return;
    }
    setSeedRunning(true);
    try {
      await api.post(`/admin/envs/${env}/seed`, {
        mode: seedMode,
        organization_name: seedOrg.trim(),
        rooftop_names: rooftopList,
      });
      toast.success("Seed completed");
    } catch {
      toast.error("Seed failed");
    } finally {
      setSeedRunning(false);
    }
  };

  const activeCalls = health?.active_calls ?? 0;
  const queueDepth  = health?.queue_depth  ?? 0;
  const workers     = health?.workers      ?? 0;
  const maxMetric   = Math.max(activeCalls, queueDepth, workers, 1);

  return (
    <div className="h-full flex flex-col gap-3 animate-in fade-in duration-500 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1
            className="text-2xl"
            style={{
              color: "#f7f8f8",
              fontWeight: 510,
              letterSpacing: "-0.288px",
              fontFeatureSettings: FF,
            }}
          >
            Admin Controls
          </h1>
          <p
            className="text-xs flex items-center gap-1.5 mt-0.5"
            style={{ color: "#62666d", fontFeatureSettings: FF }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse inline-block"
              style={{ background: "#10b981" }}
            />
            Administration Console
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label
            className="text-[9px] uppercase tracking-widest pl-1"
            style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
          >
            Environment
          </label>
          <DropdownSelect
            value={env}
            onChange={(v) => setEnv(v as Environment)}
            options={envs.map((e) => ({ value: e.name, label: e.name }))}
          />
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-4">

        {/* ── Left: ACS + Seed ── */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-3 min-h-0">

          {/* ACS Toggle */}
          <div
            className="rounded-lg p-4 flex flex-col gap-3 border-l-2 shrink-0 border"
            style={{
              background: "#191a1b",
              borderLeftColor: "#7170ff",
              borderColor: "rgba(255,255,255,0.08)",
              borderLeftWidth: "2px",
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{ background: "rgba(113,112,255,0.1)" }}
              >
                <span
                  className="material-symbols-outlined text-sm"
                  style={{ color: "#7170ff", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                >
                  security
                </span>
              </div>
              <h2
                className="text-xs uppercase tracking-widest"
                style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
              >
                ACS Toggle
              </h2>
            </div>
            <p
              className="text-xs leading-relaxed"
              style={{ color: "#8a8f98", fontFeatureSettings: FF }}
            >
              Real-time monitoring and scoring for active communications.
            </p>
            <button
              onClick={() => setShowAcsConfirm(true)}
              className="w-full py-2 rounded-md text-xs uppercase tracking-widest transition-all active:scale-[0.98] border"
              style={{
                background: "rgba(255,113,108,0.08)",
                color: "#ff716c",
                borderColor: "rgba(255,113,108,0.2)",
                fontWeight: 510,
                fontFeatureSettings: FF,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,113,108,0.14)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,113,108,0.08)"; }}
            >
              Disable ACS
            </button>
          </div>

          {/* Seed Runner */}
          <div
            className="rounded-lg p-4 flex flex-col gap-3 min-h-0 border"
            style={{
              background: "#191a1b",
              borderColor: "rgba(255,255,255,0.08)",
              borderLeft: "2px solid rgba(113,112,255,0.3)",
            }}
          >
            <div className="flex items-center gap-2 shrink-0">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{ background: "rgba(113,112,255,0.1)" }}
              >
                <span
                  className="material-symbols-outlined text-sm"
                  style={{ color: "#7170ff", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                >
                  rocket_launch
                </span>
              </div>
              <h2
                className="text-xs uppercase tracking-widest"
                style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
              >
                Seed Runner
              </h2>
            </div>

            <div className="flex flex-col gap-2 min-h-0">
              {/* Mode */}
              <DropdownSelect
                value={seedMode}
                onChange={setSeedMode}
                options={SEED_MODES.map((m) => ({ value: m.value, label: m.label }))}
                fullWidth
                size="sm"
              />

              <input
                type="text"
                placeholder="Organization name"
                value={seedOrg}
                onChange={(e) => setSeedOrg(e.target.value)}
                className="w-full rounded-md px-3 py-2 text-xs border focus:outline-none shrink-0 placeholder:text-[#62666d] transition-colors"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  borderColor: "rgba(255,255,255,0.08)",
                  color: "#d0d6e0",
                  fontFeatureSettings: FF,
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(113,112,255,0.4)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              />

              <textarea
                placeholder="Rooftop names (one per line)"
                value={seedRooftops}
                onChange={(e) => setSeedRooftops(e.target.value)}
                rows={2}
                className="w-full rounded-md px-3 py-2 text-xs border focus:outline-none resize-none placeholder:text-[#62666d] transition-colors"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  borderColor: "rgba(255,255,255,0.08)",
                  color: "#d0d6e0",
                  fontFeatureSettings: FF,
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(113,112,255,0.4)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              />

              <button
                onClick={handleRunSeed}
                disabled={seedRunning}
                className="w-full py-2.5 rounded-md text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                style={{
                  background: seedRunning ? "rgba(94,106,210,0.15)" : "#5e6ad2",
                  color: seedRunning ? "#7170ff" : "#f7f8f8",
                  fontWeight: 510,
                  fontFeatureSettings: FF,
                }}
                onMouseEnter={(e) => {
                  if (!seedRunning) (e.currentTarget as HTMLButtonElement).style.background = "#828fff";
                }}
                onMouseLeave={(e) => {
                  if (!seedRunning) (e.currentTarget as HTMLButtonElement).style.background = "#5e6ad2";
                }}
              >
                <span
                  className={`material-symbols-outlined text-sm ${seedRunning ? "animate-spin" : ""}`}
                  style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                >
                  {seedRunning ? "refresh" : "play_arrow"}
                </span>
                {seedRunning ? "Running…" : "Run Seed"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: System Health ── */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-3 min-h-0">

          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span
                className="material-symbols-outlined text-base"
                style={{ color: "#62666d", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
              >
                analytics
              </span>
              <h3
                className="text-xs uppercase tracking-widest"
                style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
              >
                System Health Monitoring
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] uppercase tracking-widest"
                style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
              >
                Auto-refresh active
              </span>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#10b981" }} />
            </div>
          </div>

          {/* 3 metric cards */}
          <div className="grid grid-cols-3 gap-3 shrink-0">
            <HealthCard icon="pulse_alert" label="Active Calls" value={health?.active_calls} loading={isLoading} max={maxMetric} emptyLabel="0%" />
            <HealthCard icon="layers"      label="Queue Depth"  value={health?.queue_depth}  loading={isLoading} max={maxMetric} emptyLabel="Empty" />
            <HealthCard icon="memory"      label="Workers"      value={health?.workers}       loading={isLoading} max={maxMetric} emptyLabel="Idle" />
          </div>

          {/* Waveform card */}
          <div
            className="flex-1 min-h-0 rounded-lg p-4 relative overflow-hidden border"
            style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(circle at 50% 50%, rgba(94,106,210,0.05) 0%, transparent 70%)" }}
            />
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div className="flex justify-between items-center">
                <h4
                  className="text-xs uppercase tracking-widest"
                  style={{ color: "#7170ff", fontWeight: 510, fontFeatureSettings: FF }}
                >
                  Global Cluster Load
                </h4>
                <span
                  className="text-[10px]"
                  style={{
                    color: "rgba(255,255,255,0.2)",
                    fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace",
                  }}
                >
                  HASH: 0x821f92e
                </span>
              </div>
              <div className="flex items-end gap-1 h-10">
                {WAVEFORM_HEIGHTS.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      height: `${h}px`,
                      background: "#5e6ad2",
                      opacity: 0.1 + (h / 12) * 0.5,
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {["Latency: 0ms", "Uptime: 99.9%"].map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-widest border"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      color: "#62666d",
                      borderColor: "rgba(255,255,255,0.06)",
                      fontWeight: 510,
                      fontFeatureSettings: FF,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex justify-between items-center shrink-0 pt-2 border-t"
            style={{ borderColor: "rgba(255,255,255,0.05)" }}
          >
            <div className="flex gap-6">
              {[{ label: "Deployment hash", value: "7f2a1c90_main" }, { label: "Node location", value: "US-EAST-01" }].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span
                    className="text-[9px] uppercase tracking-[0.2em]"
                    style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
                  >
                    {label}
                  </span>
                  <span
                    className="text-[10px]"
                    style={{
                      color: "#8a8f98",
                      fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace",
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── ACS confirm modal ── */}
      {showAcsConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowAcsConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl p-6 border flex flex-col gap-4"
            style={{
              background: "#191a1b",
              borderColor: "rgba(255,113,108,0.2)",
              boxShadow: "rgba(0,0,0,0) 0px 8px 2px, rgba(0,0,0,0.01) 0px 5px 2px, rgba(0,0,0,0.04) 0px 3px 2px, rgba(0,0,0,0.07) 0px 1px 1px, rgba(0,0,0,0.08) 0px 0px 1px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center"
              style={{ background: "rgba(255,113,108,0.1)" }}
            >
              <span
                className="material-symbols-outlined text-sm"
                style={{ color: "#ff716c", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
              >
                warning
              </span>
            </div>
            <div>
              <h3
                className="text-sm mb-1"
                style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
              >
                Disable Active Call Scoring?
              </h3>
              <p
                className="text-xs leading-relaxed"
                style={{ color: "#8a8f98", fontFeatureSettings: FF }}
              >
                This will stop real-time scoring on{" "}
                <span style={{ color: "#7170ff" }}>{env}</span>. Can be re-enabled at any time.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="flex-1 py-2 rounded-md text-xs border transition-all"
                style={{
                  background: "transparent",
                  color: "#8a8f98",
                  borderColor: "rgba(255,255,255,0.08)",
                  fontWeight: 510,
                  fontFeatureSettings: FF,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                onClick={() => setShowAcsConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 py-2 rounded-md text-xs border active:scale-[0.98] transition-all"
                style={{
                  background: "rgba(255,113,108,0.1)",
                  color: "#ff716c",
                  borderColor: "rgba(255,113,108,0.25)",
                  fontWeight: 510,
                  fontFeatureSettings: FF,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,113,108,0.18)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,113,108,0.1)"; }}
                onClick={() => { setShowAcsConfirm(false); handleAcsDisable(); }}
              >
                Disable ACS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  HealthCard                                                          */
/* ──────────────────────────────────────────────────────────────────── */

function HealthCard({ icon, label, value, loading, max, emptyLabel }: {
  icon: string; label: string; value?: number; loading: boolean; max: number; emptyLabel: string;
}) {
  const pct      = value != null && max > 0 ? Math.round((value / max) * 100) : 0;
  const display  = value != null ? String(value) : "0";
  const barLabel = value ? `${pct}%` : emptyLabel;

  return (
    <div
      className="rounded-lg p-4 flex flex-col justify-between border transition-all"
      style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(113,112,255,0.25)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
    >
      <div className="flex justify-between items-start">
        <span
          className="text-[10px] uppercase tracking-[0.1em]"
          style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: '"cv01", "ss03"' }}
        >
          {label}
        </span>
        <span
          className="material-symbols-outlined text-base"
          style={{
            color: "rgba(255,255,255,0.12)",
            fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
          }}
        >
          {icon}
        </span>
      </div>
      <div className="my-2">
        {loading ? (
          <Skeleton className="h-8 w-16" style={{ background: "rgba(255,255,255,0.05)" }} />
        ) : (
          <span
            className="text-3xl leading-none"
            style={{ color: "#f7f8f8", fontWeight: 590, letterSpacing: "-0.704px", fontFeatureSettings: '"cv01", "ss03"' }}
          >
            {display}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div
          className="h-px flex-1 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: "#5e6ad2" }}
          />
        </div>
        <span
          className="text-[9px] shrink-0"
          style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: '"cv01", "ss03"' }}
        >
          {barLabel}
        </span>
      </div>
    </div>
  );
}
