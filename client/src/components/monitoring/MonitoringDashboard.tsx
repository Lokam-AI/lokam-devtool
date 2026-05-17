import { useEffect, useState } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  Tooltip,
  BarChart,
  Bar,
  YAxis,
} from "recharts";
import type { LogEntryData } from "@/components/monitoring/LogEntry";
import type { Filters } from "@/components/monitoring/LogFilters";

const FF = '"cv01", "ss03"' as const;
const MONO = "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace";
const API_BASE = `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/v1`;

interface DashboardData {
  errorRate: LogEntryData[];
  errorsByService: LogEntryData[];
  logVolume: LogEntryData[];
  criticalCount: LogEntryData[];
  callInitErrors: LogEntryData[];
  smsFailures: LogEntryData[];
  acsErrors: LogEntryData[];
  recentErrors: LogEntryData[];
  warningRate: LogEntryData[];
  mainBackendErrors: LogEntryData[];
  dataPipelineErrors: LogEntryData[];
  totalLogCount: number;
}

// --- aggregation helpers ---

function toBuckets(
  entries: LogEntryData[],
  hours: number,
  n = 12,
): { time: string; count: number }[] {
  const bucketMs = (hours * 3600 * 1000) / n;
  const now = Date.now();
  const start = now - hours * 3600 * 1000;
  const buckets = Array.from({ length: n }, (_, i) => {
    const t = new Date(start + i * bucketMs);
    return {
      time: t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      count: 0,
    };
  });
  for (const e of entries) {
    const idx = Math.min(Math.floor((e.timestamp - start) / bucketMs), n - 1);
    if (idx >= 0) buckets[idx].count++;
  }
  return buckets;
}

function byService(entries: LogEntryData[]): { service: string; count: number }[] {
  const map = new Map<string, number>();
  for (const e of entries) map.set(e.service, (map.get(e.service) ?? 0) + 1);
  return [...map.entries()]
    .map(([service, count]) => ({ service, count }))
    .sort((a, b) => b.count - a.count);
}

// --- fetch helper ---

function buildParams(
  filters: Filters,
  opts: { services?: string[]; levels?: string[]; search?: string; limit: number },
): URLSearchParams {
  const p = new URLSearchParams();
  filters.envs.forEach((e) => p.append("envs", e));
  p.set("hours", String(filters.hours));
  p.set("limit", String(opts.limit));
  opts.services?.forEach((s) => p.append("services", s));
  opts.levels?.forEach((l) => p.append("levels", l));
  if (opts.search) p.set("search", opts.search);
  return p;
}

async function fetchPanel(url: string): Promise<LogEntryData[]> {
  const { data } = await axios.get<LogEntryData[]>(url, { withCredentials: true });
  return data;
}

// --- panel shell ---

const PANEL_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 8,
  padding: 12,
  height: 180,
  display: "flex",
  flexDirection: "column",
};

const TOOLTIP_STYLE = {
  background: "#1a1b1e",
  border: "1px solid rgba(255,255,255,0.1)",
  fontSize: 11,
  color: "#d0d6e0",
  fontFamily: MONO,
};

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[10px] uppercase tracking-wider mb-1.5 shrink-0"
      style={{ color: "#42464d", fontFamily: MONO, fontFeatureSettings: FF }}
    >
      {children}
    </span>
  );
}

function Skeleton() {
  return (
    <div
      className="animate-pulse rounded flex-1"
      style={{ background: "rgba(255,255,255,0.05)" }}
    />
  );
}

function Empty({ text = "No data" }: { text?: string }) {
  return (
    <div
      className="flex-1 flex items-center justify-center text-[11px]"
      style={{ color: "#42464d", fontFamily: MONO }}
    >
      {text}
    </div>
  );
}

// --- panel components ---

function LinePanel({
  label,
  data,
  loading,
  color = "#ef4444",
}: {
  label: string;
  data: { time: string; count: number }[];
  loading: boolean;
  color?: string;
}) {
  const hasData = data.some((d) => d.count > 0);
  return (
    <div style={PANEL_STYLE}>
      <PanelLabel>{label}</PanelLabel>
      {loading ? (
        <Skeleton />
      ) : !hasData ? (
        <Empty text="No errors" />
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 9, fill: "#42464d", fontFamily: MONO }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "rgba(255,255,255,0.1)" }} />
              <Line
                type="monotone"
                dataKey="count"
                stroke={color}
                dot={false}
                strokeWidth={1.5}
                activeDot={{ r: 3, fill: color }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function BarPanel({
  label,
  data,
  loading,
  color = "#ef4444",
  maxItems = 6,
}: {
  label: string;
  data: { service: string; count: number }[];
  loading: boolean;
  color?: string;
  maxItems?: number;
}) {
  const rows = data.slice(0, maxItems);
  return (
    <div style={PANEL_STYLE}>
      <PanelLabel>{label}</PanelLabel>
      {loading ? (
        <Skeleton />
      ) : rows.length === 0 ? (
        <Empty />
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={rows}
              margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 9, fill: "#42464d", fontFamily: MONO }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="service"
                tick={{ fontSize: 9, fill: "#62666d", fontFamily: MONO }}
                width={88}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="count" fill={color} radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function StatPanel({
  label,
  count,
  loading,
  color = "#ff4444",
  sublabel = "events",
  sparkData,
}: {
  label: string;
  count: number;
  loading: boolean;
  color?: string;
  sublabel?: string;
  sparkData?: { count: number }[];
}) {
  return (
    <div style={PANEL_STYLE}>
      <PanelLabel>{label}</PanelLabel>
      {loading ? (
        <Skeleton />
      ) : (
        <div className="flex-1 flex items-center justify-center gap-4">
          <div className="flex flex-col items-center">
            <span
              style={{
                fontSize: 44,
                fontWeight: 700,
                lineHeight: 1,
                color: count > 0 ? color : "#42464d",
                fontFamily: MONO,
                fontFeatureSettings: '"tnum"',
              }}
            >
              {count > 0 ? count : "—"}
            </span>
            <span
              className="text-[10px] mt-1"
              style={{ color: "#42464d", fontFamily: MONO }}
            >
              {sublabel}
            </span>
          </div>
          {sparkData && sparkData.some((d) => d.count > 0) && (
            <LineChart width={80} height={48} data={sparkData}>
              <Line
                type="monotone"
                dataKey="count"
                stroke={color}
                dot={false}
                strokeWidth={1}
              />
            </LineChart>
          )}
        </div>
      )}
    </div>
  );
}

function FeedPanel({
  label,
  entries,
  loading,
  fullWidth = false,
}: {
  label: string;
  entries: LogEntryData[];
  loading: boolean;
  fullWidth?: boolean;
}) {
  const style: React.CSSProperties = fullWidth
    ? { ...PANEL_STYLE, height: "auto", minHeight: 200 }
    : PANEL_STYLE;
  return (
    <div style={style}>
      <PanelLabel>{label}</PanelLabel>
      {loading ? (
        <Skeleton />
      ) : entries.length === 0 ? (
        <Empty text="No recent errors" />
      ) : (
        <div className={fullWidth ? undefined : "flex-1 overflow-y-auto min-h-0"} style={{ scrollbarWidth: "none" }}>
          {entries.map((e, i) => (
            <div
              key={`${e.timestamp}-${i}`}
              className="flex items-start gap-1.5 py-1"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              <span
                className="shrink-0 text-[9px] tabular-nums w-20"
                style={{ color: "#42464d", fontFamily: MONO, marginTop: 1 }}
              >
                {new Date(e.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span
                className="shrink-0 text-[9px] px-1 rounded w-28 text-center"
                style={{
                  color: "#ef4444",
                  background: "rgba(239,68,68,0.12)",
                  fontFamily: MONO,
                  marginTop: 1,
                }}
              >
                {e.service}
              </span>
              <span
                className={fullWidth ? "text-[10px]" : "text-[10px] truncate"}
                style={{ color: "#d0d6e0", fontFamily: MONO }}
              >
                {e.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- main component ---

interface Props {
  filters: Filters;
}

const POLL_INTERVAL_MS = 30_000;

export function MonitoringDashboard({ filters }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = (isInitial: boolean) => {
      if (isInitial) setLoading(true);

      const q = (opts: { services?: string[]; levels?: string[]; search?: string; limit: number }) =>
        fetchPanel(`${API_BASE}/monitoring/query?${buildParams(filters, opts)}`);

      const countParams = new URLSearchParams();
      filters.envs.forEach((e) => countParams.append("envs", e));
      countParams.set("hours", String(filters.hours));

      Promise.all([
        q({ levels: ["error"], limit: 1000 }),
        q({ levels: ["error"], limit: 1000 }),
        q({ limit: 1000 }),
        q({ levels: ["critical"], limit: 1000 }),
        q({ services: ["call-initiator"], levels: ["error"], limit: 500 }),
        q({ services: ["main-backend"], levels: ["error"], search: "sms", limit: 500 }),
        q({ services: ["acs-worker"], levels: ["error"], limit: 500 }),
        q({ levels: ["error"], limit: 50 }),
        q({ levels: ["warning"], limit: 1000 }),
        q({ services: ["main-backend"], levels: ["error"], limit: 500 }),
        q({ services: ["data-ingestion", "dms-sync", "insights-analyzer"], levels: ["error"], limit: 500 }),
        axios.get<{ count: number }>(`${API_BASE}/monitoring/count?${countParams}`, { withCredentials: true })
          .then((r) => r.data.count),
      ])
      .then(([errorRate, errorsByService, logVolume, criticalCount, callInitErrors, smsFailures, acsErrors, recentErrors, warningRate, mainBackendErrors, dataPipelineErrors, totalLogCount]) => {
        setData({ errorRate, errorsByService, logVolume, criticalCount, callInitErrors, smsFailures, acsErrors, recentErrors, warningRate, mainBackendErrors, dataPipelineErrors, totalLogCount: totalLogCount as number });
      })
      .catch((e) => console.error("Dashboard fetch failed:", e))
      .finally(() => { if (isInitial) setLoading(false); });
    };

    fetchAll(true);
    const timer = setInterval(() => fetchAll(false), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [filters.envs.slice().sort().join(","), filters.hours]); // eslint-disable-line react-hooks/exhaustive-deps

  const h = filters.hours;

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ minHeight: 0 }}
    >
      <div className="grid grid-cols-4 gap-3 p-4">
        {/* Row 1 */}
        <LinePanel
          label="Prod Error Rate"
          data={data ? toBuckets(data.errorRate, h) : []}
          loading={loading}
        />
        <BarPanel
          label="Errors by Service"
          data={data ? byService(data.errorsByService) : []}
          loading={loading}
          color="#ef4444"
        />
        <BarPanel
          label="Log Volume by Service"
          data={data ? byService(data.logVolume) : []}
          loading={loading}
          color="#7170ff"
        />
        <StatPanel
          label="Critical Errors"
          count={data ? data.criticalCount.length : 0}
          loading={loading}
          color="#ff4444"
          sublabel="critical errors"
        />

        {/* Row 2 */}
        <LinePanel
          label="Call Initiator Errors"
          data={data ? toBuckets(data.callInitErrors, h) : []}
          loading={loading}
        />
        <StatPanel
          label="SMS Failures"
          count={data ? data.smsFailures.length : 0}
          loading={loading}
          color="#f59e0b"
          sublabel="sms errors"
          sparkData={data ? toBuckets(data.smsFailures, h, 8) : undefined}
        />
        <LinePanel
          label="ACS Worker Errors"
          data={data ? toBuckets(data.acsErrors, h) : []}
          loading={loading}
        />
        <BarPanel
          label="Warnings by Service"
          data={data ? byService(data.warningRate) : []}
          loading={loading}
          color="#f59e0b"
        />

        {/* Row 3 */}
        <LinePanel
          label="Warning Rate"
          data={data ? toBuckets(data.warningRate, h) : []}
          loading={loading}
          color="#f59e0b"
        />
        <LinePanel
          label="Main Backend Errors"
          data={data ? toBuckets(data.mainBackendErrors, h) : []}
          loading={loading}
          color="#ef4444"
        />
        <StatPanel
          label="Data Pipeline Errors"
          count={data ? data.dataPipelineErrors.length : 0}
          loading={loading}
          color="#f59e0b"
          sublabel="ingestion · dms · insights"
          sparkData={data ? toBuckets(data.dataPipelineErrors, h, 8) : undefined}
        />
        <StatPanel
          label="Total Log Volume"
          count={data ? data.totalLogCount : 0}
          loading={loading}
          color="#7170ff"
          sublabel="log entries"
        />
      </div>

      {/* Full-width error feed at the bottom */}
      <div className="px-4 pb-4">
        <FeedPanel
          label="Live Error Feed"
          entries={data ? data.recentErrors : []}
          loading={loading}
          fullWidth
        />
      </div>
    </div>
  );
}
