import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { LogEntry, type LogEntryData } from "@/components/monitoring/LogEntry";
import { LogFilters, type Filters, type Service } from "@/components/monitoring/LogFilters";
import { Activity } from "lucide-react";

const FF = '"cv01", "ss03"' as const;
const MONO = "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace";
const API_BASE = `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/v1`;
const MAX_LIVE_ENTRIES = 500;

export default function MonitoringPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [entries, setEntries] = useState<LogEntryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    services: [],
    levels: [],
    envs: ["prod"],
    hours: 1,
    search: "",
    mode: "live",
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollRef = useRef(true);

  // Load service list once
  useEffect(() => {
    axios
      .get<{ services: Service[]; envs: unknown[] }>(`${API_BASE}/monitoring/services`, { withCredentials: true })
      .then((r) => setServices(r.data.services))
      .catch(() => {});
  }, []);

  // History query
  const runQuery = useCallback(async (f: Filters) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      f.services.forEach((s) => params.append("services", s));
      f.levels.forEach((l) => params.append("levels", l));
      f.envs.forEach((e) => params.append("envs", e));
      if (f.search) params.set("search", f.search);
      params.set("hours", String(f.hours));
      params.set("limit", "200");

      const { data } = await axios.get<LogEntryData[]>(
        `${API_BASE}/monitoring/query?${params}`,
        { withCredentials: true },
      );
      setEntries(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Query failed");
    } finally {
      setLoading(false);
    }
  }, []);

  // Live SSE stream
  const startStream = useCallback((f: Filters) => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setEntries([]);
    setError(null);

    const params = new URLSearchParams();
    f.services.forEach((s) => params.append("services", s));
    f.levels.forEach((l) => params.append("levels", l));
    f.envs.forEach((e) => params.append("envs", e));

    const url = `${API_BASE}/monitoring/stream?${params}`;
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.onmessage = (ev) => {
      try {
        const entry = JSON.parse(ev.data) as LogEntryData;
        if ("error" in entry) return;
        setEntries((prev) => {
          const next = [entry, ...prev];
          return next.length > MAX_LIVE_ENTRIES ? next.slice(0, MAX_LIVE_ENTRIES) : next;
        });
        if (autoScrollRef.current) {
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        }
      } catch {}
    };

    es.onerror = () => setError("Stream disconnected — reconnecting…");
  }, []);

  // React to filter changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (filters.mode === "live") {
      startStream(filters);
    } else {
      debounceRef.current = setTimeout(() => runQuery(filters), 400);
    }

    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [filters, startStream, runQuery]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    autoScrollRef.current = nearBottom;
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "#0c0d0e", minHeight: 0 }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Activity className="h-4 w-4" style={{ color: "#7170ff" }} />
        <span
          className="text-[14px]"
          style={{ color: "#f7f8f8", fontWeight: 500, fontFeatureSettings: FF }}
        >
          Monitoring
        </span>
        {filters.mode === "live" && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{
              color: "#10b981",
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.2)",
              fontFamily: MONO,
            }}
          >
            ● LIVE
          </span>
        )}
        <span className="text-[12px] ml-auto" style={{ color: "#42464d", fontFamily: MONO }}>
          {entries.length} entries
        </span>
      </div>

      {/* Filters */}
      <LogFilters services={services} filters={filters} onChange={setFilters} />

      {/* Error banner */}
      {error && (
        <div
          className="px-4 py-2 text-[12px] shrink-0"
          style={{
            color: "#ef4444",
            background: "rgba(239,68,68,0.06)",
            borderBottom: "1px solid rgba(239,68,68,0.1)",
            fontFamily: MONO,
          }}
        >
          {error}
        </div>
      )}

      {/* Log list */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ minHeight: 0 }}
        onScroll={handleScroll}
      >
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div
              className="h-5 w-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "#7170ff", borderTopColor: "transparent" }}
            />
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div
            className="flex items-center justify-center py-16 text-[13px]"
            style={{ color: "#42464d", fontFamily: MONO }}
          >
            {filters.mode === "live" ? "Waiting for log events…" : "No logs found for the selected filters."}
          </div>
        )}

        {entries.map((e, i) => (
          <LogEntry key={`${e.timestamp}-${i}`} entry={e} />
        ))}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
