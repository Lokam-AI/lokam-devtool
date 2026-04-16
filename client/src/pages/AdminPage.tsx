import { useState, useEffect } from "react";
import { useHealth } from "@/hooks/use-calls";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { Environment, EnvConfig } from "@/types";
import api, { apiGetEnvs } from "@/lib/api";

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
          <h1 className="text-2xl font-bold tracking-[0.02em]" style={{ color: "#ffffff" }}>
            Admin Controls
          </h1>
          <p className="text-xs flex items-center gap-1.5 mt-0.5" style={{ color: "#adaaaa" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: "#4ff5df" }} />
            Administration Console
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-bold uppercase tracking-widest pl-1" style={{ color: "#adaaaa" }}>
            Environment
          </label>
          <div
            className="rounded-xl px-4 py-2 flex items-center gap-2 border"
            style={{ background: "#1c1c1e", borderColor: "rgba(73,72,71,0.15)" }}
          >
            <select
              value={env}
              onChange={(e) => setEnv(e.target.value as Environment)}
              className="bg-transparent border-none focus:outline-none text-sm font-semibold cursor-pointer appearance-none"
              style={{ color: "#4ff5df" }}
            >
              {envs.map((e) => (
                <option key={e.name} value={e.name} style={{ background: "#1c1c1e" }}>{e.name}</option>
              ))}
            </select>
            <span className="text-xs select-none" style={{ color: "#4ff5df" }}>▾</span>
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-4">

        {/* ── Left: ACS + Seed ── */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-3 min-h-0">

          {/* ACS Toggle */}
          <div
            className="rounded-xl p-4 flex flex-col gap-3 border-l-4 shrink-0"
            style={{ background: "#1c1c1e", borderLeftColor: "#4ff5df" }}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(79,245,223,0.1)" }}>
                <span className="material-symbols-outlined text-sm" style={{ color: "#4ff5df", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>security</span>
              </div>
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#ffffff" }}>ACS Toggle</h2>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "#adaaaa" }}>
              Real-time monitoring and scoring for active communications.
            </p>
            <button
              onClick={() => setShowAcsConfirm(true)}
              className="w-full py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all active:scale-[0.98] border"
              style={{ background: "rgba(255,113,108,0.08)", color: "#ff716c", borderColor: "rgba(255,113,108,0.25)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,113,108,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,113,108,0.08)"; }}
            >
              Disable ACS
            </button>
          </div>

          {/* Seed Runner */}
          <div
            className="rounded-xl p-4 flex flex-col gap-3 min-h-0 border-l-4"
            style={{ background: "#1c1c1e", borderLeftColor: "rgba(79,245,223,0.3)" }}
          >
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(79,245,223,0.1)" }}>
                <span className="material-symbols-outlined text-sm" style={{ color: "#4ff5df", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>rocket_launch</span>
              </div>
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#ffffff" }}>Seed Runner</h2>
            </div>

            <div className="flex flex-col gap-2 min-h-0">
              {/* Mode */}
              <div className="rounded-lg px-4 py-2 flex items-center justify-between border shrink-0" style={{ background: "rgba(0,0,0,0.4)", borderColor: "rgba(73,72,71,0.1)" }}>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#adaaaa" }}>Mode</span>
                <select
                  value={seedMode}
                  onChange={(e) => setSeedMode(e.target.value)}
                  className="bg-transparent border-none focus:outline-none text-xs font-semibold cursor-pointer appearance-none"
                  style={{ color: "#ffffff" }}
                >
                  {SEED_MODES.map((m) => (
                    <option key={m.value} value={m.value} style={{ background: "#1c1c1e" }}>{m.label}</option>
                  ))}
                </select>
                <span className="text-xs select-none" style={{ color: "#adaaaa" }}>▾</span>
              </div>

              {/* Org name */}
              <input
                type="text"
                placeholder="Organization name"
                value={seedOrg}
                onChange={(e) => setSeedOrg(e.target.value)}
                className="w-full rounded-lg px-4 py-2 text-xs border focus:outline-none shrink-0"
                style={{ background: "rgba(0,0,0,0.4)", borderColor: "rgba(73,72,71,0.1)", color: "#ffffff" }}
              />

              {/* Rooftops */}
              <textarea
                placeholder="Rooftop names (one per line)"
                value={seedRooftops}
                onChange={(e) => setSeedRooftops(e.target.value)}
                rows={2}
                className="w-full rounded-lg px-4 py-2 text-xs border focus:outline-none resize-none"
                style={{ background: "rgba(0,0,0,0.4)", borderColor: "rgba(73,72,71,0.1)", color: "#ffffff" }}
              />

              {/* Run button */}
              <button
                onClick={handleRunSeed}
                disabled={seedRunning}
                className="w-full py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                style={{
                  background: seedRunning ? "rgba(79,245,223,0.15)" : "linear-gradient(135deg,#4ff5df,#22dbc6)",
                  color: seedRunning ? "#4ff5df" : "#00594f",
                  boxShadow: seedRunning ? "none" : "0 4px 16px rgba(79,245,223,0.2)",
                }}
              >
                <span className={`material-symbols-outlined text-sm ${seedRunning ? "animate-spin" : ""}`} style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
                  {seedRunning ? "refresh" : "play_arrow"}
                </span>
                {seedRunning ? "Running…" : "Run Seed"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: System Health ── */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-3 min-h-0">

          {/* Section header */}
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base" style={{ color: "#4ff5df", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>analytics</span>
              <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#ffffff" }}>System Health Monitoring</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(173,170,170,0.4)" }}>Auto-refresh active</span>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4ff5df" }} />
            </div>
          </div>

          {/* 3 metric cards */}
          <div className="grid grid-cols-3 gap-3 shrink-0">
            <HealthCard icon="pulse_alert" label="Active Calls" value={health?.active_calls} loading={isLoading} max={maxMetric} emptyLabel="0%" />
            <HealthCard icon="layers"      label="Queue Depth"  value={health?.queue_depth}  loading={isLoading} max={maxMetric} emptyLabel="Empty" />
            <HealthCard icon="memory"      label="Workers"      value={health?.workers}       loading={isLoading} max={maxMetric} emptyLabel="Idle" />
          </div>

          {/* Waveform card */}
          <div className="flex-1 min-h-0 rounded-xl p-4 relative overflow-hidden" style={{ background: "#1c1c1e" }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 50%, rgba(79,245,223,0.05) 0%, transparent 70%)" }} />
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#4ff5df" }}>Global Cluster Load</h4>
                <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>HASH: 0x821f92e</span>
              </div>
              <div className="flex items-end gap-1 h-10">
                {WAVEFORM_HEIGHTS.map((h, i) => (
                  <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}px`, background: "#4ff5df", opacity: 0.1 + (h / 12) * 0.5 }} />
                ))}
              </div>
              <div className="flex gap-2">
                {["Latency: 0ms", "Uptime: 99.9%"].map((tag) => (
                  <span key={tag} className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border" style={{ background: "rgba(0,0,0,0.3)", color: "rgba(255,255,255,0.3)", borderColor: "rgba(255,255,255,0.06)" }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Footer row */}
          <div className="flex justify-between items-center shrink-0 pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            <div className="flex gap-6">
              {[{ label: "Deployment hash", value: "7f2a1c90_main" }, { label: "Node location", value: "US-EAST-01" }].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.2)" }}>{label}</span>
                  <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>{value}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <button className="text-[10px] font-bold uppercase tracking-widest hover:underline" style={{ color: "#4ff5df" }}>View System Logs</button>
              <button
                className="text-[10px] font-bold uppercase tracking-widest transition-colors"
                style={{ color: "rgba(255,255,255,0.3)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#ffffff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
              >
                Clear Cache
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── ACS confirm modal ── */}
      {showAcsConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={() => setShowAcsConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6 border flex flex-col gap-4" style={{ background: "#1c1c1e", borderColor: "rgba(255,113,108,0.2)" }} onClick={(e) => e.stopPropagation()}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,113,108,0.1)" }}>
              <span className="material-symbols-outlined text-sm" style={{ color: "#ff716c", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>warning</span>
            </div>
            <div>
              <h3 className="text-sm font-bold mb-1" style={{ color: "#ffffff" }}>Disable Active Call Scoring?</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#adaaaa" }}>
                This will stop real-time scoring on <span style={{ color: "#4ff5df" }}>{env}</span>. Can be re-enabled at any time.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-2 rounded-xl text-xs font-bold border" style={{ background: "transparent", color: "#adaaaa", borderColor: "rgba(255,255,255,0.08)" }} onClick={() => setShowAcsConfirm(false)}>Cancel</button>
              <button className="flex-1 py-2 rounded-xl text-xs font-bold border active:scale-[0.98] transition-all" style={{ background: "rgba(255,113,108,0.12)", color: "#ff716c", borderColor: "rgba(255,113,108,0.3)" }} onClick={() => { setShowAcsConfirm(false); handleAcsDisable(); }}>Disable ACS</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HealthCard({ icon, label, value, loading, max, emptyLabel }: {
  icon: string; label: string; value?: number; loading: boolean; max: number; emptyLabel: string;
}) {
  const pct      = value != null && max > 0 ? Math.round((value / max) * 100) : 0;
  const display  = value != null ? String(value) : "0";
  const barLabel = value ? `${pct}%` : emptyLabel;

  return (
    <div
      className="rounded-xl p-4 flex flex-col justify-between border transition-all"
      style={{ background: "#1c1c1e", borderColor: "rgba(73,72,71,0.05)" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(79,245,223,0.2)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(73,72,71,0.05)"; }}
    >
      <div className="flex justify-between items-start">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "#adaaaa" }}>{label}</span>
        <span className="material-symbols-outlined text-base" style={{ color: "rgba(173,170,170,0.2)", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>{icon}</span>
      </div>
      <div className="my-2">
        {loading ? (
          <Skeleton className="h-8 w-16" style={{ background: "rgba(255,255,255,0.05)" }} />
        ) : (
          <span className="text-3xl font-black leading-none tracking-tighter" style={{ color: "#ffffff" }}>{display}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: "#4ff5df", boxShadow: pct > 0 ? "0 0 6px rgba(79,245,223,0.4)" : "none" }} />
        </div>
        <span className="text-[9px] font-bold shrink-0" style={{ color: "rgba(255,255,255,0.25)" }}>{barLabel}</span>
      </div>
    </div>
  );
}
