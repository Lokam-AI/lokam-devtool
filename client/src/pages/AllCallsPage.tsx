import { useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiGetAllCalls, apiGetAllCallsCount, apiGetEnvs } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { CallFilterBar, DEFAULT_FILTERS } from "@/components/ui/call-filters";
import { useAllCallsFilterStore } from "@/store/filter-store";
import { parseUtc } from "@/lib/utils";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  Inbox,
  PhoneCall,
  Timer,
  Star,
  Zap,
} from "lucide-react";
import type { RawCall } from "@/types";

const PAGE_SIZE = 15;
const STALE_MS = 5 * 60 * 1000;
const FF = '"cv01", "ss03"' as const;

function thisMonthRange(): DateRange {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { from, to };
}

export default function AllCallsPage() {
  const navigate = useNavigate();
  const { filters, page, setFilters, setPage } = useAllCallsFilterStore();

  // Seed dateRange on first visit (store persists undefined from DEFAULT_FILTERS)
  useEffect(() => {
    if (!filters.dateRange) setFilters({ ...filters, dateRange: thisMonthRange() });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filterBase = useMemo(() => ({
    call_status:       filters.callStatus !== "all" ? filters.callStatus : undefined,
    date_from:         filters.dateRange?.from ? format(filters.dateRange.from, "yyyy-MM-dd") : undefined,
    date_to:           filters.dateRange?.to   ? format(filters.dateRange.to,   "yyyy-MM-dd") : undefined,
    search:            filters.search    || undefined,
    organization_name: filters.org       !== "all" ? filters.org        : undefined,
    nps_filter:        filters.npsFilter !== "all" ? filters.npsFilter  : undefined,
    sort_by:           filters.sortBy,
    sort_dir:          filters.sortDir,
  }), [filters]);

  const queryParams = useMemo(() => ({
    ...filterBase,
    limit:  PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }), [filterBase, page]);

  const countParams = useMemo(() => ({
    call_status:       filters.callStatus !== "all" ? filters.callStatus : undefined,
    date_from:         filters.dateRange?.from ? format(filters.dateRange.from, "yyyy-MM-dd") : undefined,
    date_to:           filters.dateRange?.to   ? format(filters.dateRange.to,   "yyyy-MM-dd") : undefined,
    search:            filters.search    || undefined,
    organization_name: filters.org       !== "all" ? filters.org        : undefined,
    nps_filter:        filters.npsFilter !== "all" ? filters.npsFilter  : undefined,
  }), [filters]);


  const { data: batchData, isLoading } = useQuery({
    queryKey: ["all-calls", queryParams],
    queryFn: () => apiGetAllCalls(queryParams),
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  });

  const { data: totalCount } = useQuery({
    queryKey: ["all-calls-count", countParams],
    queryFn: () => apiGetAllCallsCount(countParams),
    staleTime: STALE_MS,
  });

  const completedCountParams = useMemo(() => ({ ...countParams, call_status: "Completed" }), [countParams]);
  const { data: completedTotalCount } = useQuery({
    queryKey: ["all-calls-count", completedCountParams],
    queryFn: () => apiGetAllCallsCount(completedCountParams),
    staleTime: STALE_MS,
  });

  const qc = useQueryClient();
  useEffect(() => {
    const nextParams = { ...queryParams, offset: (page + 1) * PAGE_SIZE };
    qc.prefetchQuery({ queryKey: ["all-calls", nextParams], queryFn: () => apiGetAllCalls(nextParams), staleTime: STALE_MS });
  }, [queryParams]);

  const { data: envs = [] } = useQuery({
    queryKey: ["envs"],
    queryFn: apiGetEnvs,
  });

  const orgOptions = useMemo(() =>
    [...new Set((batchData ?? []).map((c) => c.organization_name).filter(Boolean))].sort(),
  [batchData]);

  const calls = batchData ?? [];
  const filtered = calls;

  const avgDuration = useMemo(() => {
    if (!calls || calls.length === 0) return 0;
    return Math.round(calls.reduce((s, c) => s + c.duration, 0) / calls.length);
  }, [calls]);

  const avgNps = useMemo(() => {
    if (!calls) return null;
    const scored = calls.filter((c) => c.ai_nps_score !== null);
    if (scored.length === 0) return null;
    return (scored.reduce((sum, c) => sum + (c.ai_nps_score ?? 0), 0) / scored.length).toFixed(1);
  }, [calls]);

  const totalPages = totalCount ? Math.ceil(totalCount / PAGE_SIZE) : 0;
  const hasFilters = filters.search || filters.callStatus !== "all" ||
    filters.org !== "all" || filters.npsFilter !== "all" || !!filters.dateRange?.from ||
    filters.sortBy !== "date" || filters.sortDir !== "desc";

  const resetFilters = () => {
    setFilters({ ...DEFAULT_FILTERS, dateRange: thisMonthRange() });
  };

  const visiblePages = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i);
    if (page < 3) return [0, 1, 2, 3, 4];
    if (page >= totalPages - 3) return [totalPages - 5, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1];
    return [page - 2, page - 1, page, page + 1, page + 2];
  }, [page, totalPages]);

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <h1
          className="text-3xl"
          style={{
            color: "#f7f8f8",
            fontWeight: 510,
            letterSpacing: "-0.704px",
            fontFeatureSettings: FF,
          }}
        >
          All Calls
        </h1>
        <p
          className="mt-1.5 text-sm"
          style={{ color: "#8a8f98", fontWeight: 400, fontFeatureSettings: FF }}
        >
          Complete record of all call interactions across every environment.
        </p>
      </div>

      {/* ── Metric cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Calls"
          value={totalCount !== undefined ? totalCount.toLocaleString() : "—"}
          badge={{ text: "+12%", color: "#10b981" }}
          icon={<PhoneCall className="h-4 w-4" style={{ color: "#62666d" }} />}
          loading={false}
        />
        <MetricCard
          label="Avg Duration"
          value={isLoading ? "—" : formatDuration(avgDuration)}
          badge={{ text: "Stable", color: "#62666d" }}
          icon={<Timer className="h-4 w-4" style={{ color: "#62666d" }} />}
          loading={isLoading}
        />
        <MetricCard
          label="Avg NPS"
          value={isLoading ? "—" : (avgNps ?? "N/A")}
          badge={{
            text: avgNps && parseFloat(avgNps) < 7 ? "-0.2" : "Optimal",
            color: avgNps && parseFloat(avgNps) < 7 ? "#ff716c" : "#10b981",
          }}
          icon={<Star className="h-4 w-4" style={{ color: "#62666d" }} />}
          loading={isLoading}
        />
        <MetricCard
          label="Active Sessions"
          value={completedTotalCount !== undefined ? completedTotalCount.toString() : "—"}
          badge={{ text: "Live", color: "#7170ff" }}
          icon={<Zap className="h-4 w-4" style={{ color: "#62666d" }} />}
          loading={isLoading}
        />
      </div>

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <CallFilterBar
        value={filters}
        onChange={setFilters}
        showCallStatus
        showNps
        showOrg
        showDateRange
        showSort
        envOptions={envs.map((e) => e.name)}
        orgOptions={orgOptions}
        placeholder="Search by ID or Organization..."
      />

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div
        className="flex-1 rounded-lg flex flex-col overflow-hidden border"
        style={{
          background: "rgba(255,255,255,0.02)",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {["Call ID", "Organization", "Campaign", "Date", "Status", "Direction", "Duration", "NPS", "Action"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-[10px] uppercase tracking-widest whitespace-nowrap"
                    style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <Skeleton className="h-3.5 w-16" style={{ background: "rgba(255,255,255,0.04)" }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : filtered.map((call) => (
                    <CallRow key={call.id} call={call} onView={() => navigate(`/call/${call.id}`)} />
                  ))
              }
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center mb-4 border"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" }}
            >
              <Inbox className="h-5 w-5" style={{ color: "rgba(255,255,255,0.15)" }} />
            </div>
            <p
              className="text-xs uppercase tracking-widest"
              style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}
            >
              No Records Found
            </p>
            <p
              className="text-[10px] mt-1.5 uppercase tracking-wider"
              style={{ color: "#62666d", fontFeatureSettings: FF }}
            >
              {hasFilters ? "Adjust filters to expand results" : "No calls in the database yet"}
            </p>
            {hasFilters && (
              <button
                className="mt-6 px-5 py-2 rounded-md text-[10px] uppercase tracking-widest transition-all border"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  color: "#8a8f98",
                  borderColor: "rgba(255,255,255,0.08)",
                  fontWeight: 510,
                  fontFeatureSettings: FF,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#d0d6e0";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.02)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#8a8f98";
                }}
                onClick={resetFilters}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Pagination */}
        <div
          className="px-6 py-3.5 border-t flex items-center justify-between"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}
        >
          <span
            className="text-[10px] uppercase tracking-widest"
            style={{ color: "#62666d", fontFeatureSettings: FF }}
          >
            {totalCount
              ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalCount)} of ${totalCount.toLocaleString()}`
              : "No calls found"
            }
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                className="w-7 h-7 rounded-md flex items-center justify-center border transition-all disabled:opacity-25 disabled:pointer-events-none"
                style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)", color: "#8a8f98" }}
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-center gap-1">
                {visiblePages.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="w-7 h-7 rounded-md text-[11px] transition-all"
                    style={
                      p === page
                        ? { background: "#5e6ad2", color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }
                        : { color: "#62666d", fontFeatureSettings: FF }
                    }
                    onMouseEnter={(e) => {
                      if (p !== page) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      if (p !== page) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    }}
                  >
                    {p + 1}
                  </button>
                ))}
                {totalPages > 5 && page < totalPages - 4 && (
                  <>
                    <span className="text-xs px-1" style={{ color: "#62666d" }}>…</span>
                    <button
                      onClick={() => setPage(totalPages - 1)}
                      className="w-7 h-7 rounded-md text-[11px] transition-colors"
                      style={{ color: "#62666d", fontFeatureSettings: FF }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>
              <button
                className="w-7 h-7 rounded-md flex items-center justify-center border transition-all disabled:opacity-25 disabled:pointer-events-none"
                style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)", color: "#8a8f98" }}
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  MetricCard                                                          */
/* ──────────────────────────────────────────────────────────────────── */

function MetricCard({
  label, value, badge, icon, loading,
}: {
  label: string; value: string; badge: { text: string; color: string };
  icon: React.ReactNode; loading: boolean;
}) {
  return (
    <div
      className="rounded-lg p-5 border"
      style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
    >
      <div className="flex justify-between items-start mb-3">
        <span
          className="text-[10px] uppercase tracking-[0.08em]"
          style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: '"cv01", "ss03"' }}
        >
          {label}
        </span>
        {icon}
      </div>
      <div className="flex items-baseline gap-2">
        {loading ? (
          <Skeleton className="h-8 w-20" style={{ background: "rgba(255,255,255,0.05)" }} />
        ) : (
          <span
            className="text-2xl"
            style={{ color: "#f7f8f8", fontWeight: 590, fontFeatureSettings: '"cv01", "ss03"' }}
          >
            {value}
          </span>
        )}
        {!loading && (
          <span
            className="text-[10px]"
            style={{ color: badge.color, fontWeight: 510, fontFeatureSettings: '"cv01", "ss03"' }}
          >
            {badge.text}
          </span>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  CallRow                                                             */
/* ──────────────────────────────────────────────────────────────────── */

function CallRow({ call, onView }: { call: RawCall; onView: () => void }) {
  return (
    <tr
      className="group cursor-pointer transition-colors"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
      onClick={onView}
    >
      <td
        className="px-4 py-3 text-xs"
        style={{
          color: "#7170ff",
          fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace",
        }}
      >
        #{call.call_id}
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span
            className="text-sm"
            style={{ color: "#d0d6e0", fontWeight: 510, fontFeatureSettings: '"cv01", "ss03"' }}
          >
            {call.organization_name || "—"}
          </span>
          {call.rooftop_name && (
            <span
              className="text-[10px]"
              style={{ color: "#62666d", fontFeatureSettings: '"cv01", "ss03"' }}
            >
              {call.rooftop_name}
            </span>
          )}
        </div>
      </td>

      <td
        className="px-4 py-3 text-xs"
        style={{ color: "#8a8f98", fontFeatureSettings: '"cv01", "ss03"' }}
      >
        {call.campaign || "—"}
      </td>

      <td
        className="px-4 py-3 text-xs"
        style={{ color: "#62666d", fontFeatureSettings: '"cv01", "ss03"' }}
      >
        {parseUtc(call.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
        {parseUtc(call.date).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}
      </td>

      <td className="px-4 py-3">
        <CallStatusBadge status={call.call_status} />
      </td>

      <td className="px-4 py-3">
        <DirectionIndicator direction={call.direction} />
      </td>

      <td
        className="px-4 py-3 text-xs"
        style={{ color: "#8a8f98", fontFeatureSettings: '"cv01", "ss03"' }}
      >
        {formatDuration(call.duration)}
      </td>

      <td className="px-4 py-3 text-sm">
        {call.ai_nps_score !== null
          ? <NpsValue score={call.ai_nps_score} />
          : <span style={{ color: "#62666d" }}>—</span>
        }
      </td>

      <td className="px-4 py-3">
        <button
          className="px-3.5 py-1.5 text-[10px] rounded-md uppercase tracking-wider transition-all border"
          style={{
            background: "rgba(255,255,255,0.02)",
            color: "#62666d",
            borderColor: "rgba(255,255,255,0.08)",
            fontWeight: 510,
            fontFeatureSettings: '"cv01", "ss03"',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
            (e.currentTarget as HTMLButtonElement).style.color = "#8a8f98";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.02)";
            (e.currentTarget as HTMLButtonElement).style.color = "#62666d";
          }}
          onClick={(e) => { e.stopPropagation(); onView(); }}
        >
          View
        </button>
      </td>
    </tr>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Status badge                                                        */
/* ──────────────────────────────────────────────────────────────────── */

function CallStatusBadge({ status }: { status: string }) {
  if (status === "Completed") {
    return (
      <span
        className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider border"
        style={{
          background: "rgba(16,185,129,0.12)",
          color: "#10b981",
          borderColor: "rgba(16,185,129,0.2)",
          fontWeight: 510,
          fontFeatureSettings: '"cv01", "ss03"',
        }}
      >
        Completed
      </span>
    );
  }
  if (status === "Missed") {
    return (
      <span
        className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider border"
        style={{
          background: "rgba(255,113,108,0.12)",
          color: "#ff716c",
          borderColor: "rgba(255,113,108,0.2)",
          fontWeight: 510,
          fontFeatureSettings: '"cv01", "ss03"',
        }}
      >
        Missed
      </span>
    );
  }
  return (
    <span
      className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider border"
      style={{
        background: "rgba(234,179,8,0.1)",
        color: "#eab308",
        borderColor: "rgba(234,179,8,0.2)",
        fontWeight: 510,
        fontFeatureSettings: '"cv01", "ss03"',
      }}
    >
      {status || "Unknown"}
    </span>
  );
}

function DirectionIndicator({ direction }: { direction: string }) {
  if (direction === "outbound") return <ArrowUpRight className="h-4 w-4" style={{ color: "#62666d" }} />;
  if (direction === "inbound")  return <ArrowDownLeft className="h-4 w-4" style={{ color: "#62666d" }} />;
  return <span style={{ color: "#62666d" }}>—</span>;
}

function NpsValue({ score }: { score: number }) {
  const color = score >= 9 ? "#10b981" : score >= 7 ? "#eab308" : "#ff716c";
  return (
    <span style={{ color, fontWeight: 510, fontFeatureSettings: '"cv01", "ss03"' }}>
      {score}
    </span>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
