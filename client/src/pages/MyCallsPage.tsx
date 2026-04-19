import { useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useCalls, useCallsCount } from "@/hooks/use-calls";
import { apiGetCalls } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { CallFilterBar, DEFAULT_FILTERS } from "@/components/ui/call-filters";
import { useMyCallsFilterStore } from "@/store/filter-store";
import { parseUtc } from "@/lib/utils";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Inbox,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

const PAGE_SIZE = 15;
const STALE_MS = 5 * 60 * 1000;

const FF = '"cv01", "ss03"' as const;

function thisMonthRange(): DateRange {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { from, to };
}

export default function MyCallsPage() {
  const navigate = useNavigate();
  const { filters, page, setFilters, setPage } = useMyCallsFilterStore();

  // Seed dateRange on first visit (store persists undefined from DEFAULT_FILTERS)
  useEffect(() => {
    if (!filters.dateRange) setFilters({ ...filters, dateRange: thisMonthRange() });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filterBase = useMemo(() => ({
    eval_status:       filters.evalStatus !== "all" ? filters.evalStatus : undefined,
    date_from:         filters.dateRange?.from ? format(filters.dateRange.from, "yyyy-MM-dd") : undefined,
    date_to:           filters.dateRange?.to   ? format(filters.dateRange.to,   "yyyy-MM-dd") : undefined,
    search:            filters.search || undefined,
    organization_name: filters.org !== "all" ? filters.org : undefined,
    nps_filter:        filters.npsFilter !== "all" ? filters.npsFilter : undefined,
    sort_by:           filters.sortBy,
    sort_dir:          filters.sortDir,
  }), [filters]);

  const callParams = useMemo(() => ({
    ...filterBase,
    limit:  PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  }), [filterBase, page]);

  const countParams = useMemo(() => ({
    eval_status:       filters.evalStatus !== "all" ? filters.evalStatus : undefined,
    date_from:         filters.dateRange?.from ? format(filters.dateRange.from, "yyyy-MM-dd") : undefined,
    date_to:           filters.dateRange?.to   ? format(filters.dateRange.to,   "yyyy-MM-dd") : undefined,
    search:            filters.search || undefined,
    organization_name: filters.org !== "all" ? filters.org : undefined,
    nps_filter:        filters.npsFilter !== "all" ? filters.npsFilter : undefined,
  }), [filters]);

  const { data, isLoading, isError } = useCalls(callParams);
  const { data: totalCount } = useCallsCount(countParams);

  const qc = useQueryClient();
  useEffect(() => {
    const nextParams = { ...callParams, offset: page * PAGE_SIZE };
    qc.prefetchQuery({ queryKey: ["calls", nextParams], queryFn: () => apiGetCalls(nextParams), staleTime: STALE_MS });
  }, [callParams]);

  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = data ?? [];

  const stats = useMemo(() => {
    const total = totalCount ?? 0;
    const completed = (data ?? []).filter((c) => c.eval.status === "completed").length;
    const pending = (data ?? []).filter((c) => c.eval.status === "pending").length;
    const totalDuration = (data ?? []).reduce((sum, c) => sum + c.call.duration, 0);
    const avgDuration = (data ?? []).length > 0 ? Math.round(totalDuration / (data ?? []).length) : 0;
    return { total, pending, completed, avgDuration };
  }, [data, totalCount]);

  const orgOptions = useMemo(() =>
    [...new Set((data ?? []).map((c) => c.call.organization_name).filter(Boolean))].sort(),
  [data]);

  const hasFilters =
    filters.search || filters.evalStatus !== "all" || filters.npsFilter !== "all" ||
    filters.org !== "all" || !!filters.dateRange?.from || filters.sortBy !== "date" || filters.sortDir !== "desc";

  const visiblePages = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (safePage <= 3) return [1, 2, 3, 4, 5];
    if (safePage >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [safePage - 2, safePage - 1, safePage, safePage + 1, safePage + 2];
  }, [safePage, totalPages]);

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <p
          className="text-xs uppercase tracking-widest"
          style={{ color: "#ff716c", fontWeight: 510, fontFeatureSettings: FF }}
        >
          Failed to load calls. Please refresh the page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">

      {/* ── Header ───────────────────────────────────────────────────── */}
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
          Reviewer Call Queue
        </h1>
        <p
          className="mt-1.5 text-sm"
          style={{ color: "#8a8f98", fontWeight: 400, fontFeatureSettings: FF }}
        >
          Managing developer support sessions and automated system logs.
        </p>
      </div>

      {/* ── Metric cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Calls */}
        <div
          className="relative overflow-hidden p-5 rounded-lg border"
          style={{
            background: "#191a1b",
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <p
            className="uppercase tracking-[0.08em] text-[10px] mb-3"
            style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
          >
            Total Calls
          </p>
          <div className="flex items-center justify-between">
            {isLoading ? (
              <Skeleton className="h-7 w-16" style={{ background: "rgba(255,255,255,0.05)" }} />
            ) : (
              <h2
                className="text-2xl"
                style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
              >
                {stats.total.toLocaleString()}
              </h2>
            )}
            <span
              className="text-[10px] flex items-center gap-1"
              style={{ color: "#7170ff", fontWeight: 510, fontFeatureSettings: FF }}
            >
              <TrendingUp className="h-3 w-3" />
              LIVE
            </span>
          </div>
        </div>

        {/* Pending Review */}
        <div
          className="p-5 rounded-lg border"
          style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <p
            className="uppercase tracking-[0.08em] text-[10px] mb-3"
            style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
          >
            Pending Review
          </p>
          <div className="flex items-center justify-between">
            {isLoading ? (
              <Skeleton className="h-7 w-10" style={{ background: "rgba(255,255,255,0.05)" }} />
            ) : (
              <h2
                className="text-2xl"
                style={{
                  color: stats.pending > 0 ? "#ff716c" : "#f7f8f8",
                  fontWeight: 510,
                  fontFeatureSettings: FF,
                }}
              >
                {stats.pending}
              </h2>
            )}
            <span
              className="material-symbols-outlined"
              style={{
                color: "rgba(255,255,255,0.12)",
                fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
              }}
            >
              pending_actions
            </span>
          </div>
        </div>

        {/* Completed */}
        <div
          className="p-5 rounded-lg border"
          style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <p
            className="uppercase tracking-[0.08em] text-[10px] mb-3"
            style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
          >
            Completed
          </p>
          <div className="flex items-center justify-between">
            {isLoading ? (
              <Skeleton className="h-7 w-10" style={{ background: "rgba(255,255,255,0.05)" }} />
            ) : (
              <h2
                className="text-2xl"
                style={{ color: "#10b981", fontWeight: 510, fontFeatureSettings: FF }}
              >
                {stats.completed.toLocaleString()}
              </h2>
            )}
            <span
              className="material-symbols-outlined"
              style={{
                color: "rgba(255,255,255,0.12)",
                fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
              }}
            >
              verified
            </span>
          </div>
        </div>

        {/* Avg Duration */}
        <div
          className="p-5 rounded-lg border"
          style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <p
            className="uppercase tracking-[0.08em] text-[10px] mb-3"
            style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
          >
            Avg Duration
          </p>
          <div className="flex items-center justify-between">
            {isLoading ? (
              <Skeleton className="h-7 w-14" style={{ background: "rgba(255,255,255,0.05)" }} />
            ) : (
              <h2
                className="text-2xl"
                style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
              >
                {formatDuration(stats.avgDuration)}
              </h2>
            )}
            <span
              className="text-[10px]"
              style={{ color: "#62666d", fontFeatureSettings: FF }}
            >
              min/call
            </span>
          </div>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <CallFilterBar
        value={filters}
        onChange={setFilters}
        showEvalStatus
        showNps
        showOrg
        showDateRange
        showSort
        orgOptions={orgOptions}
        placeholder="Search call records..."
      />

      {/* ── Table ────────────────────────────────────────────────────── */}
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
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-3.5 w-16" style={{ background: "rgba(255,255,255,0.04)" }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : paginated?.map(({ call, eval: ev }) => (
                    <CallRow
                      key={call.id}
                      call={call}
                      ev={ev}
                      onNavigate={() => navigate(`/eval/${call.id}`)}
                    />
                  ))
              }
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {!isLoading && paginated.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center mb-4 border"
              style={{
                background: "rgba(255,255,255,0.02)",
                borderColor: "rgba(255,255,255,0.08)",
              }}
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
              {hasFilters ? "Adjust filters to expand results" : "Calls assigned to you will appear here"}
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
                onClick={() => setFilters({ ...DEFAULT_FILTERS, dateRange: thisMonthRange() })}
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
            {totalCount ? `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, totalCount)} of ${totalCount}` : "No calls found"}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                className="w-7 h-7 rounded-md flex items-center justify-center transition-all disabled:opacity-25 disabled:pointer-events-none border"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  color: "#8a8f98",
                  borderColor: "rgba(255,255,255,0.08)",
                }}
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                      p === safePage
                        ? { background: "#5e6ad2", color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }
                        : { color: "#62666d", fontFeatureSettings: FF }
                    }
                    onMouseEnter={(e) => {
                      if (p !== safePage) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      if (p !== safePage) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                className="w-7 h-7 rounded-md flex items-center justify-center transition-all disabled:opacity-25 disabled:pointer-events-none border"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  color: "#8a8f98",
                  borderColor: "rgba(255,255,255,0.08)",
                }}
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
/*  CallRow                                                             */
/* ──────────────────────────────────────────────────────────────────── */

const FF_INNER = '"cv01", "ss03"' as const;

function CallRow({
  call,
  ev,
  onNavigate,
}: {
  call: {
    id: string; call_id: string; organization_name: string; rooftop_name: string;
    campaign: string; date: string; direction: string; duration: number; ai_nps_score: number | null;
    source_env?: string;
  };
  ev: { status: string };
  onNavigate: () => void;
}) {
  return (
    <tr
      className="group cursor-pointer transition-colors"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
      onClick={onNavigate}
    >
      {/* Call ID */}
      <td
        className="px-4 py-3 text-xs"
        style={{
          color: "#7170ff",
          fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace",
        }}
      >
        #{call.call_id}
      </td>

      {/* Organization */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span
            className="text-sm"
            style={{ color: "#d0d6e0", fontWeight: 510, fontFeatureSettings: FF_INNER }}
          >
            {call.organization_name || "—"}
          </span>
          {call.rooftop_name && (
            <span
              className="text-[10px]"
              style={{ color: "#62666d", fontFeatureSettings: FF_INNER }}
            >
              {call.rooftop_name}
            </span>
          )}
        </div>
      </td>

      {/* Campaign */}
      <td
        className="px-4 py-3 text-xs"
        style={{ color: "#8a8f98", fontFeatureSettings: FF_INNER }}
      >
        {call.campaign || "—"}
      </td>

      {/* Date */}
      <td
        className="px-4 py-3 text-xs"
        style={{ color: "#62666d", fontFeatureSettings: FF_INNER }}
      >
        {parseUtc(call.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
        {parseUtc(call.date).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}
      </td>

      {/* Status pill */}
      <td className="px-4 py-3">
        <StatusPill status={ev.status} />
      </td>

      {/* Direction */}
      <td className="px-4 py-3">
        <DirectionIcon direction={call.direction} />
      </td>

      {/* Duration */}
      <td
        className="px-4 py-3 text-xs"
        style={{ color: "#8a8f98", fontFeatureSettings: FF_INNER }}
      >
        {formatDuration(call.duration)}
      </td>

      {/* NPS */}
      <td className="px-4 py-3 text-sm">
        {call.ai_nps_score !== null
          ? <NpsValue score={call.ai_nps_score} />
          : <span style={{ color: "#62666d" }}>—</span>
        }
      </td>

      {/* Action */}
      <td className="px-4 py-3">
        {ev.status === "pending" ? (
          <button
            className="px-3.5 py-1.5 text-[10px] rounded-md uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              background: "#5e6ad2",
              color: "#f7f8f8",
              fontWeight: 510,
              fontFeatureSettings: FF_INNER,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#828fff"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#5e6ad2"; }}
            onClick={(e) => { e.stopPropagation(); onNavigate(); }}
          >
            Evaluate
          </button>
        ) : (
          <button
            className="px-3.5 py-1.5 text-[10px] rounded-md uppercase tracking-wider transition-all border"
            style={{
              background: "rgba(255,255,255,0.02)",
              color: "#62666d",
              borderColor: "rgba(255,255,255,0.08)",
              fontWeight: 510,
              fontFeatureSettings: FF_INNER,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
              (e.currentTarget as HTMLButtonElement).style.color = "#8a8f98";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.02)";
              (e.currentTarget as HTMLButtonElement).style.color = "#62666d";
            }}
            onClick={(e) => { e.stopPropagation(); onNavigate(); }}
          >
            Revisit
          </button>
        )}
      </td>
    </tr>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Status pill                                                         */
/* ──────────────────────────────────────────────────────────────────── */

function StatusPill({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <span
        className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider"
        style={{
          background: "rgba(16,185,129,0.12)",
          color: "#10b981",
          fontWeight: 510,
          fontFeatureSettings: '"cv01", "ss03"',
          border: "1px solid rgba(16,185,129,0.2)",
        }}
      >
        Completed
      </span>
    );
  }
  return (
    <span
      className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider"
      style={{
        background: "rgba(234,179,8,0.1)",
        color: "#eab308",
        fontWeight: 510,
        fontFeatureSettings: '"cv01", "ss03"',
        border: "1px solid rgba(234,179,8,0.2)",
      }}
    >
      Pending
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Direction icon                                                      */
/* ──────────────────────────────────────────────────────────────────── */

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === "outbound") {
    return <ArrowUpRight className="h-4 w-4" style={{ color: "#62666d" }} />;
  }
  if (direction === "inbound") {
    return <ArrowDownLeft className="h-4 w-4" style={{ color: "#62666d" }} />;
  }
  return <span style={{ color: "#62666d" }}>—</span>;
}

/* ──────────────────────────────────────────────────────────────────── */
/*  NPS value                                                           */
/* ──────────────────────────────────────────────────────────────────── */

function NpsValue({ score }: { score: number }) {
  const color = score >= 9 ? "#10b981" : score >= 7 ? "#eab308" : "#ff716c";
  return (
    <span style={{ color, fontWeight: 510, fontFeatureSettings: '"cv01", "ss03"' }}>
      {score}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Duration formatter                                                  */
/* ──────────────────────────────────────────────────────────────────── */

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
