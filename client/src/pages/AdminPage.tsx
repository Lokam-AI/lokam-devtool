import { useState, useEffect } from "react";
import { useHealth, useAppMetrics, useSystemHealth } from "@/hooks/use-calls";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { toast } from "sonner";
import type { EnvConfig, } from "@/types";
import api, { apiGetEnvs, apiListFeatureFlags, apiToggleFeatureFlag } from "@/lib/api";
import type { FeatureFlagItem } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const FF = '"cv01", "ss03"' as const;

const SEED_MODES = [
  { value: "--check-and-seed",  label: "Check & Seed"    },
  { value: "--force-recreate",  label: "Force Recreate"  },
  { value: "--dry-run",         label: "Dry Run"         },
  { value: "--stats-only",      label: "Stats Only"      },
];

const WAVEFORM_HEIGHTS = [4, 6, 4, 6, 8, 6, 4, 6, 4, 12, 6, 4, 8, 5, 4, 7];

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default function AdminPage() {
  const [envs, setEnvs]                       = useState<EnvConfig[]>([]);
  const [acsEnvs, setAcsEnvs]                 = useState<string[]>([]);
  const [seedEnv, setSeedEnv]                 = useState("");
  const [showAcsConfirm, setShowAcsConfirm]   = useState(false);
  const [flags, setFlags]                     = useState<FeatureFlagItem[]>([]);
  const [flagsLoading, setFlagsLoading]       = useState(true);
  const [flagConfirm, setFlagConfirm]         = useState<{ key: string; env: string; enabled: boolean } | null>(null);
  const [flagToggling, setFlagToggling]       = useState(false);
  const [seedMode, setSeedMode]               = useState("--force-recreate");
  const [seedOrg, setSeedOrg]                 = useState("");
  const [seedRooftops, setSeedRooftops]       = useState("");
  const [seedRunning, setSeedRunning]         = useState(false);
  const [syncDate, setSyncDate]               = useState(yesterday);
  const [syncRunning, setSyncRunning]         = useState(false);
  const [syncResult, setSyncResult]           = useState<{ calls: Record<string, number>; bugs: Record<string, number> } | null>(null);
  const { data: health, isLoading }           = useHealth();
  const [metricsEnv, setMetricsEnv]           = useState("playground");
  const { data: appMetrics, isLoading: metricsLoading, dataUpdatedAt } = useAppMetrics(metricsEnv);
  const { data: sysHealth, isLoading: sysLoading } = useSystemHealth(metricsEnv);
  const isSuperadmin                          = useAuthStore((s) => s.hasRole("superadmin"));

  useEffect(() => {
    apiGetEnvs().then((data) => {
      setEnvs(data);
      const arena = data.find((e) => e.name === "arena");
      setSeedEnv(arena ? "arena" : (data[0]?.name ?? ""));
    }).catch(() => {});

    apiListFeatureFlags()
      .then(setFlags)
      .catch(() => {})
      .finally(() => setFlagsLoading(false));
  }, []);

  const envOptions    = envs.map((e) => ({ value: e.name, label: e.name }));
  const acsEnvOptions = envs.filter((e) => e.name !== "app");

  const handleAcsDisable = async () => {
    if (acsEnvs.length === 0) return;
    try {
      await Promise.all(acsEnvs.map((env) => api.post(`/admin/envs/${env}/acs`, { enabled: false })));
      toast.success(`ACS disabled on ${acsEnvs.join(", ")}`);
    } catch {
      toast.error("Failed to disable ACS on one or more envs");
    }
  };

  const handleFlagToggle = async () => {
    if (!flagConfirm) return;
    setFlagToggling(true);
    try {
      const updated = await apiToggleFeatureFlag(flagConfirm.key, flagConfirm.env, flagConfirm.enabled);
      setFlags((prev) => prev.map((f) => f.key === updated.key ? updated : f));
      toast.success(`${flagConfirm.key} ${flagConfirm.enabled ? "enabled" : "disabled"} on ${flagConfirm.env}`);
    } catch {
      toast.error(`Failed to toggle ${flagConfirm.key} on ${flagConfirm.env}`);
    } finally {
      setFlagToggling(false);
      setFlagConfirm(null);
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
      await api.post(`/admin/envs/${seedEnv}/seed`, {
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

  const handleRunSync = async () => {
    setSyncRunning(true);
    setSyncResult(null);
    try {
      const { data } = await api.post("/admin/sync", { date: syncDate });
      setSyncResult({ calls: data.calls, bugs: data.bugs });
      const totalCalls = Object.values(data.calls as Record<string, number>).reduce((a, b) => a + b, 0);
      const totalBugs  = Object.values(data.bugs  as Record<string, number>).reduce((a, b) => a + b, 0);
      toast.success(`Sync complete — ${totalCalls} calls, ${totalBugs} bugs`);
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncRunning(false);
    }
  };

  const activeCalls  = sysHealth?.active_calls  ?? health?.active_calls  ?? 0;
  const queueDepth   = sysHealth?.queue_depth   ?? health?.queue_depth   ?? 0;
  const workers      = sysHealth?.workers       ?? health?.workers       ?? 0;
  const maxConcurrent = sysHealth?.max_concurrent_calls ?? 1;
  const maxMetric    = Math.max(activeCalls, queueDepth, workers, 1);
  const capacityPct  = maxConcurrent > 0 ? Math.round((activeCalls / maxConcurrent) * 100) : 0;
  const healthLoading = isLoading && sysLoading;

  return (
    <div className="h-full flex flex-col gap-3 animate-in fade-in duration-500 overflow-hidden">

      {/* ── Header ── */}
      <div className="shrink-0">
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

      {/* ── Main grid ── */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-4">

        {/* ── Left: ACS + Seed ── */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-3 min-h-0">

          <div className="flex items-center gap-2 shrink-0">
            <span
              className="material-symbols-outlined text-base"
              style={{ color: "#62666d", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
            >
              settings
            </span>
            <h3
              className="text-xs uppercase tracking-widest"
              style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
            >
              Power Tools
            </h3>
          </div>

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
            <div className="flex flex-col gap-2">
              {acsEnvOptions.map((env) => {
                const checked = acsEnvs.includes(env.name);
                return (
                  <label
                    key={env.name}
                    className="flex items-center gap-2.5 cursor-pointer group"
                  >
                    <div
                      className="w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0"
                      style={{
                        background: checked ? "rgba(113,112,255,0.2)" : "rgba(255,255,255,0.02)",
                        borderColor: checked ? "rgba(113,112,255,0.5)" : "rgba(255,255,255,0.12)",
                      }}
                    >
                      {checked && (
                        <span
                          className="material-symbols-outlined"
                          style={{ color: "#7170ff", fontSize: "11px", fontVariationSettings: "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 20" }}
                        >
                          check
                        </span>
                      )}
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={(e) => {
                          setAcsEnvs(e.target.checked
                            ? [...acsEnvs, env.name]
                            : acsEnvs.filter((n) => n !== env.name)
                          );
                        }}
                      />
                    </div>
                    <span
                      className="text-xs capitalize"
                      style={{ color: checked ? "#d0d6e0" : "#8a8f98", fontFeatureSettings: FF }}
                    >
                      {env.name}
                    </span>
                  </label>
                );
              })}
            </div>
            <button
              onClick={() => setShowAcsConfirm(true)}
              disabled={acsEnvs.length === 0}
              className="w-full py-2 rounded-md text-xs uppercase tracking-widest transition-all active:scale-[0.98] border disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "rgba(255,113,108,0.08)",
                color: "#ff716c",
                borderColor: "rgba(255,113,108,0.2)",
                fontWeight: 510,
                fontFeatureSettings: FF,
              }}
              onMouseEnter={(e) => { if (acsEnvs.length > 0) e.currentTarget.style.background = "rgba(255,113,108,0.14)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,113,108,0.08)"; }}
            >
              Disable ACS
            </button>
          </div>

          {/* Feature Flags */}
          <div
            className="rounded-lg p-4 flex flex-col gap-3 shrink-0 border"
            style={{
              background: "#191a1b",
              borderLeftColor: "#10b981",
              borderColor: "rgba(255,255,255,0.08)",
              borderLeftWidth: "2px",
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{ background: "rgba(16,185,129,0.1)" }}
              >
                <span
                  className="material-symbols-outlined text-sm"
                  style={{ color: "#10b981", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                >
                  toggle_on
                </span>
              </div>
              <h2
                className="text-xs uppercase tracking-widest"
                style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
              >
                Feature Flags
              </h2>
            </div>

            {flagsLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-6 w-full" style={{ background: "rgba(255,255,255,0.05)" }} />
                <Skeleton className="h-6 w-full" style={{ background: "rgba(255,255,255,0.05)" }} />
              </div>
            ) : flags.length === 0 ? (
              <p className="text-xs" style={{ color: "#62666d", fontFeatureSettings: FF }}>
                No feature flags found in PostHog.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {flags.map((flag) => (
                  <div key={flag.key} className="flex flex-col gap-1.5">
                    <span className="text-xs" style={{ color: "#d0d6e0", fontFeatureSettings: FF }}>
                      {flag.name}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {flag.environments.map(({ env, enabled }) => (
                        <button
                          key={env}
                          onClick={() => setFlagConfirm({ key: flag.key, env, enabled: !enabled })}
                          className="px-2.5 py-1 rounded-md text-[10px] uppercase tracking-widest border transition-all active:scale-[0.97]"
                          style={{
                            background: enabled ? "rgba(16,185,129,0.1)" : "rgba(255,113,108,0.08)",
                            color: enabled ? "#10b981" : "#ff716c",
                            borderColor: enabled ? "rgba(16,185,129,0.25)" : "rgba(255,113,108,0.2)",
                            fontWeight: 510,
                            fontFeatureSettings: FF,
                            cursor: "pointer",
                          }}
                        >
                          {env} · {enabled ? "on" : "off"}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            <div className="flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
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
              <DropdownSelect
                value={seedEnv}
                onChange={setSeedEnv}
                options={envOptions}
                size="sm"
              />
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

          {/* Data Sync */}
          {isSuperadmin && (
            <div
              className="rounded-lg p-4 flex flex-col gap-3 shrink-0 border"
              style={{
                background: "#191a1b",
                borderColor: "rgba(255,255,255,0.08)",
                borderLeft: "2px solid rgba(16,185,129,0.35)",
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: "rgba(16,185,129,0.1)" }}
                >
                  <span
                    className="material-symbols-outlined text-sm"
                    style={{ color: "#10b981", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                  >
                    sync
                  </span>
                </div>
                <h2
                  className="text-xs uppercase tracking-widest"
                  style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
                >
                  Data Sync
                </h2>
              </div>

              <input
                type="date"
                value={syncDate}
                onChange={(e) => { setSyncDate(e.target.value); setSyncResult(null); }}
                className="w-full rounded-md px-3 py-2 text-xs border focus:outline-none shrink-0 transition-colors"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  borderColor: "rgba(255,255,255,0.08)",
                  color: "#d0d6e0",
                  fontFeatureSettings: FF,
                  colorScheme: "dark",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(16,185,129,0.4)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              />

              {syncResult && (
                <div
                  className="rounded-md px-3 py-2 text-xs"
                  style={{ background: "rgba(16,185,129,0.06)", color: "#8a8f98", fontFeatureSettings: FF }}
                >
                  {Object.entries(syncResult.calls).map(([e, n]) => (
                    <div key={e}>{e}: <span style={{ color: "#10b981" }}>{n} calls</span></div>
                  ))}
                  {Object.entries(syncResult.bugs).map(([e, n]) => (
                    <div key={e}>{e}: <span style={{ color: "#10b981" }}>{n} bugs</span></div>
                  ))}
                </div>
              )}

              <button
                onClick={handleRunSync}
                disabled={syncRunning || !syncDate}
                className="w-full py-2 rounded-md text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed border"
                style={{
                  background: syncRunning ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.12)",
                  color: "#10b981",
                  borderColor: "rgba(16,185,129,0.2)",
                  fontWeight: 510,
                  fontFeatureSettings: FF,
                }}
                onMouseEnter={(e) => { if (!syncRunning) (e.currentTarget as HTMLButtonElement).style.background = "rgba(16,185,129,0.2)"; }}
                onMouseLeave={(e) => { if (!syncRunning) (e.currentTarget as HTMLButtonElement).style.background = "rgba(16,185,129,0.12)"; }}
              >
                <span
                  className={`material-symbols-outlined text-sm ${syncRunning ? "animate-spin" : ""}`}
                  style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                >
                  {syncRunning ? "refresh" : "sync"}
                </span>
                {syncRunning ? "Syncing…" : "Run Sync"}
              </button>
            </div>
          )}
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
            <HealthCard icon="pulse_alert" label="Active Calls" value={activeCalls} loading={healthLoading} max={maxConcurrent || maxMetric} emptyLabel="0%" />
            <HealthCard icon="layers"      label="Queue Depth"  value={queueDepth}  loading={healthLoading} max={maxMetric} emptyLabel="Empty" />
            <HealthCard icon="memory"      label="ACS Slots"    value={workers}     loading={healthLoading} max={maxConcurrent || maxMetric} emptyLabel="Idle" />
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
                    color: sysHealth?.database_connected === false ? "#ef4444" : "rgba(255,255,255,0.2)",
                    fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace",
                  }}
                >
                  {sysHealth ? (sysHealth.database_connected ? "DB: CONNECTED" : "DB: DOWN") : "ENV: " + metricsEnv.toUpperCase()}
                </span>
              </div>
              <div className="flex items-end gap-1 h-10">
                {WAVEFORM_HEIGHTS.map((h, i) => {
                  const isActive = maxConcurrent > 0 && i < Math.round((activeCalls / maxConcurrent) * WAVEFORM_HEIGHTS.length);
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-sm transition-all duration-700"
                      style={{
                        height: `${h}px`,
                        background: isActive ? "#7170ff" : "#5e6ad2",
                        opacity: isActive ? 0.7 + (h / 12) * 0.3 : 0.1 + (h / 12) * 0.3,
                      }}
                    />
                  );
                })}
              </div>
              <div className="flex gap-2">
                {[
                  `Latency: ${appMetrics ? `${appMetrics.p50_latency_ms}ms` : "—"}`,
                  `Capacity: ${capacityPct}% (${activeCalls}/${maxConcurrent})`,
                ].map((tag) => (
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

          {/* App Metrics */}
          <AppMetricsSection
            env={metricsEnv}
            onEnvChange={setMetricsEnv}
            metrics={appMetrics ?? null}
            loading={metricsLoading}
            updatedAt={dataUpdatedAt}
          />

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

      {/* ── Feature flag confirm modal ── */}
      {flagConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
          onClick={() => setFlagConfirm(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl p-6 border flex flex-col gap-4"
            style={{
              background: "#191a1b",
              borderColor: "rgba(16,185,129,0.2)",
              boxShadow: "rgba(0,0,0,0.08) 0px 0px 1px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center"
              style={{ background: "rgba(16,185,129,0.1)" }}
            >
              <span
                className="material-symbols-outlined text-sm"
                style={{ color: "#10b981", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
              >
                toggle_on
              </span>
            </div>
            <div>
              <h3 className="text-sm mb-1" style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}>
                {flagConfirm.enabled ? "Enable" : "Disable"} feature flag?
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "#8a8f98", fontFeatureSettings: FF }}>
                <span style={{ color: "#7170ff" }}>{flagConfirm.key}</span> will be{" "}
                {flagConfirm.enabled ? "enabled" : "disabled"} on{" "}
                <span style={{ color: "#7170ff" }}>{flagConfirm.env}</span>.
                Takes effect on the next Lambda run (~2 min).
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="flex-1 py-2 rounded-md text-xs border transition-all"
                style={{ background: "transparent", color: "#8a8f98", borderColor: "rgba(255,255,255,0.08)", fontWeight: 510, fontFeatureSettings: FF }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                onClick={() => setFlagConfirm(null)}
              >
                Cancel
              </button>
              <button
                disabled={flagToggling}
                className="flex-1 py-2 rounded-md text-xs border active:scale-[0.98] transition-all disabled:opacity-50"
                style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", borderColor: "rgba(16,185,129,0.25)", fontWeight: 510, fontFeatureSettings: FF }}
                onMouseEnter={(e) => { if (!flagToggling) e.currentTarget.style.background = "rgba(16,185,129,0.18)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(16,185,129,0.1)"; }}
                onClick={handleFlagToggle}
              >
                {flagToggling ? "Updating…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                {acsEnvs.map((e, i) => (
                  <span key={e}>
                    <span style={{ color: "#7170ff" }}>{e}</span>
                    {i < acsEnvs.length - 1 ? ", " : ""}
                  </span>
                ))}. Can be re-enabled at any time.
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
/*  AppMetricsSection                                                   */
/* ──────────────────────────────────────────────────────────────────── */

import type { AppMetrics } from "@/lib/api";

const MONO = "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace";
const METRIC_ENVS = ["prod", "arena", "playground"] as const;

function MetricStat({
  label, value, sub, color, loading,
}: {
  label: string; value: string; sub?: string; color?: string; loading: boolean;
}) {
  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-1 border"
      style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
    >
      <span className="text-[9px] uppercase tracking-[0.15em]" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>
        {label}
      </span>
      {loading ? (
        <div className="h-7 w-16 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
      ) : (
        <span className="text-2xl leading-none tabular-nums" style={{ color: color ?? "#f7f8f8", fontWeight: 590, fontFamily: MONO }}>
          {value}
        </span>
      )}
      {sub && <span className="text-[9px]" style={{ color: "#42464d", fontFamily: MONO }}>{sub}</span>}
    </div>
  );
}

function AppMetricsSection({
  env, onEnvChange, metrics, loading, updatedAt,
}: {
  env: string;
  onEnvChange: (e: string) => void;
  metrics: AppMetrics | null;
  loading: boolean;
  updatedAt: number;
}) {
  const secsAgo = updatedAt ? Math.round((Date.now() - updatedAt) / 1000) : null;
  const unavailable = !loading && metrics === null;

  const errColor = metrics
    ? metrics.error_rate_percent > 1 ? "#ef4444" : "#10b981"
    : "#62666d";
  const p99Color = metrics
    ? metrics.p99_latency_ms > 1000 ? "#ef4444" : metrics.p99_latency_ms > 500 ? "#f59e0b" : "#f7f8f8"
    : "#62666d";

  return (
    <div className="flex flex-col gap-2 shrink-0">
      {/* Sub-header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>
          App Metrics
        </span>
        <div className="flex items-center gap-2">
          {secsAgo !== null && !loading && (
            <span className="text-[9px]" style={{ color: "#42464d", fontFamily: MONO }}>
              all-time · updated {secsAgo}s ago
            </span>
          )}
          <div className="flex gap-0.5">
            {METRIC_ENVS.map((e) => (
              <button
                key={e}
                onClick={() => onEnvChange(e)}
                className="text-[9px] px-2 py-0.5 rounded transition-all"
                style={{
                  fontFamily: MONO,
                  color: env === e ? "#f7f8f8" : "#42464d",
                  background: env === e ? "rgba(255,255,255,0.08)" : "transparent",
                  border: `1px solid ${env === e ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)"}`,
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      {unavailable ? (
        <div
          className="rounded-lg p-3 text-[11px] text-center border"
          style={{ color: "#42464d", background: "#191a1b", borderColor: "rgba(255,255,255,0.06)", fontFamily: MONO }}
        >
          Metrics unavailable
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <MetricStat label="Request Rate" value={loading ? "—" : `${metrics?.request_rate_per_second ?? 0}`} sub="req/s" loading={loading} />
            <MetricStat label="Error Rate" value={loading ? "—" : `${metrics?.error_rate_percent ?? 0}%`} color={errColor} loading={loading} />
            <MetricStat label="Active Requests" value={loading ? "—" : String(metrics?.active_requests ?? 0)} loading={loading} />
            <MetricStat label="P50 Latency" value={loading ? "—" : `${metrics?.p50_latency_ms ?? 0}ms`} loading={loading} />
            <MetricStat label="P99 Latency" value={loading ? "—" : `${metrics?.p99_latency_ms ?? 0}ms`} color={p99Color} loading={loading} />

            {/* Slowest routes */}
            <div
              className="rounded-lg p-3 flex flex-col gap-1.5 border"
              style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
            >
              <span className="text-[9px] uppercase tracking-[0.15em] shrink-0" style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}>
                Slowest Routes
              </span>
              {loading ? (
                <div className="flex flex-col gap-1">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-3 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)", width: `${70 - i * 15}%` }} />
                  ))}
                </div>
              ) : (metrics?.top_slowest_routes ?? []).length === 0 ? (
                <span className="text-[9px]" style={{ color: "#42464d", fontFamily: MONO }}>No data</span>
              ) : (
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {(metrics?.top_slowest_routes ?? []).map((r) => (
                    <div key={r.route} className="flex items-center justify-between gap-2">
                      <span className="text-[9px] truncate" style={{ color: "#8a8f98", fontFamily: MONO }}>{r.route}</span>
                      <span className="text-[9px] shrink-0 tabular-nums" style={{ color: r.p99_ms > 500 ? "#f59e0b" : "#62666d", fontFamily: MONO }}>{r.p99_ms}ms</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
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
