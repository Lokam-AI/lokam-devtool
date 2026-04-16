import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCalls } from "@/hooks/use-calls";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Inbox,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Filter,
} from "lucide-react";

const PAGE_SIZE = 10;

export default function MyCallsPage() {
  const { data, isLoading } = useCalls();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, dateRange, searchQuery]);

  const filtered = useMemo(() => {
    return data?.filter((c) => {
      if (statusFilter !== "all" && c.eval.status !== statusFilter) return false;
      if (dateRange?.from) {
        const callDate = new Date(c.call.date);
        const from = new Date(dateRange.from); from.setHours(0, 0, 0, 0);
        const to = dateRange.to ? new Date(dateRange.to) : new Date(from);
        to.setHours(23, 59, 59, 999);
        if (callDate < from || callDate > to) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.call.call_id.toLowerCase().includes(q) ||
          c.call.campaign.toLowerCase().includes(q) ||
          c.call.organization_name.toLowerCase().includes(q) ||
          c.call.rooftop_name.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data, statusFilter, dateRange, searchQuery]);

  const totalPages = Math.max(1, Math.ceil((filtered?.length ?? 0) / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered?.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const stats = useMemo(() => {
    if (!data) return { total: 0, pending: 0, completed: 0, avgDuration: 0 };
    const total = data.length;
    const completed = data.filter((c) => c.eval.status === "completed").length;
    const pending = total - completed;
    const totalDuration = data.reduce((sum, c) => sum + c.call.duration, 0);
    const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0;
    return { total, pending, completed, avgDuration };
  }, [data]);

  const hasFilters = statusFilter !== "all" || !!dateRange?.from || searchQuery;

  const visiblePages = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (safePage <= 3) return [1, 2, 3, 4, 5];
    if (safePage >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [safePage - 2, safePage - 1, safePage, safePage + 1, safePage + 2];
  }, [safePage, totalPages]);

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-[0.02em]" style={{ color: "#ffffff" }}>
            Reviewer Call Queue
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#adaaaa" }}>
            Managing developer support sessions and automated system logs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />

          {/* Filters toggle */}
          <button
            className="px-4 py-2 rounded-xl flex items-center gap-2 text-sm transition-all border"
            style={{
              background: showFilters ? "rgba(79,245,223,0.08)" : "rgba(255,255,255,0.05)",
              color: showFilters ? "#4ff5df" : "#adaaaa",
              borderColor: showFilters ? "rgba(79,245,223,0.3)" : "rgba(73,72,71,0.2)",
            }}
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasFilters && (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "#4ff5df" }}
              />
            )}
          </button>
        </div>
      </div>

      {/* ── Expanded filter bar ──────────────────────────────────────── */}
      {showFilters && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 duration-200"
          style={{ background: "#131313", borderColor: "rgba(73,72,71,0.2)" }}
        >
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl flex-1 max-w-xs border focus-within:border-[#4ff5df]/50 transition-all"
            style={{ background: "#000000", borderColor: "rgba(255,255,255,0.05)" }}
          >
            <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "#adaaaa" }} />
            <input
              className="bg-transparent border-none text-xs focus:outline-none w-full"
              style={{ color: "#ffffff" }}
              placeholder="Search call records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="px-4 py-2 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer border appearance-none"
            style={{
              background: "#000000",
              color: "#adaaaa",
              borderColor: "rgba(255,255,255,0.05)",
            }}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="all"       style={{ background: "#1c1c1e" }}>All Status</option>
            <option value="pending"   style={{ background: "#1c1c1e" }}>Pending</option>
            <option value="completed" style={{ background: "#1c1c1e" }}>Completed</option>
          </select>

          {hasFilters && (
            <button
              className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
              style={{ color: "#adaaaa" }}
              onMouseEnter={(e) => { (e.currentTarget).style.color = "#ffffff"; }}
              onMouseLeave={(e) => { (e.currentTarget).style.color = "#adaaaa"; }}
              onClick={() => { setStatusFilter("all"); setDateRange(undefined); setSearchQuery(""); }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* ── Metric cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Calls — aurora glow */}
        <div
          className="relative overflow-hidden p-5 rounded-xl border"
          style={{ background: "#131313", borderColor: "rgba(73,72,71,0.1)" }}
        >
          {/* Aurora glow */}
          <div
            className="absolute -top-10 -right-10 w-[150px] h-[150px] rounded-full pointer-events-none"
            style={{ background: "#22dbc6", filter: "blur(80px)", opacity: 0.15 }}
          />
          <p
            className="uppercase tracking-[0.05em] text-[0.6875rem] font-semibold mb-2"
            style={{ color: "#adaaaa" }}
          >
            Total Calls
          </p>
          <div className="flex items-center justify-between relative z-10">
            {isLoading ? (
              <Skeleton className="h-8 w-16" style={{ background: "rgba(255,255,255,0.05)" }} />
            ) : (
              <h2 className="text-2xl font-bold" style={{ color: "#ffffff" }}>
                {stats.total.toLocaleString()}
              </h2>
            )}
            <span className="text-xs font-medium flex items-center gap-1" style={{ color: "#4ff5df" }}>
              <TrendingUp className="h-3.5 w-3.5" />
              LIVE
            </span>
          </div>
        </div>

        {/* Pending Review */}
        <div
          className="p-5 rounded-xl border"
          style={{ background: "#131313", borderColor: "rgba(73,72,71,0.1)" }}
        >
          <p
            className="uppercase tracking-[0.05em] text-[0.6875rem] font-semibold mb-2"
            style={{ color: "#adaaaa" }}
          >
            Pending Review
          </p>
          <div className="flex items-center justify-between">
            {isLoading ? (
              <Skeleton className="h-8 w-10" style={{ background: "rgba(255,255,255,0.05)" }} />
            ) : (
              <h2 className="text-2xl font-bold" style={{ color: stats.pending > 0 ? "#ff716c" : "#ffffff" }}>
                {stats.pending}
              </h2>
            )}
            <span
              className="material-symbols-outlined"
              style={{
                color: "rgba(173,170,170,0.3)",
                fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
              }}
            >
              pending_actions
            </span>
          </div>
        </div>

        {/* Completed */}
        <div
          className="p-5 rounded-xl border"
          style={{ background: "#131313", borderColor: "rgba(73,72,71,0.1)" }}
        >
          <p
            className="uppercase tracking-[0.05em] text-[0.6875rem] font-semibold mb-2"
            style={{ color: "#adaaaa" }}
          >
            Completed
          </p>
          <div className="flex items-center justify-between">
            {isLoading ? (
              <Skeleton className="h-8 w-10" style={{ background: "rgba(255,255,255,0.05)" }} />
            ) : (
              <h2 className="text-2xl font-bold" style={{ color: "#4ff5df" }}>
                {stats.completed.toLocaleString()}
              </h2>
            )}
            <span
              className="material-symbols-outlined"
              style={{
                color: "rgba(173,170,170,0.3)",
                fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
              }}
            >
              verified
            </span>
          </div>
        </div>

        {/* Avg Duration */}
        <div
          className="p-5 rounded-xl border"
          style={{ background: "#131313", borderColor: "rgba(73,72,71,0.1)" }}
        >
          <p
            className="uppercase tracking-[0.05em] text-[0.6875rem] font-semibold mb-2"
            style={{ color: "#adaaaa" }}
          >
            Avg Duration
          </p>
          <div className="flex items-center justify-between">
            {isLoading ? (
              <Skeleton className="h-8 w-14" style={{ background: "rgba(255,255,255,0.05)" }} />
            ) : (
              <h2 className="text-2xl font-bold" style={{ color: "#ffffff" }}>
                {formatDuration(stats.avgDuration)}
              </h2>
            )}
            <span className="text-xs" style={{ color: "rgba(173,170,170,0.5)" }}>min/call</span>
          </div>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div
        className="flex-1 rounded-xl flex flex-col overflow-hidden border"
        style={{
          background: "#131313",
          borderColor: "rgba(73,72,71,0.1)",
          boxShadow: "0px 24px 48px rgba(255,255,255,0.06)",
        }}
      >
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "rgba(32,31,31,0.5)" }}>
                {["Call ID", "Organization", "Campaign", "Date", "Status", "Direction", "Duration", "NPS", "Action"].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-4 text-[0.6875rem] uppercase tracking-widest font-bold whitespace-nowrap"
                    style={{ color: "#adaaaa" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-6 py-4">
                          <Skeleton className="h-3.5 w-16" style={{ background: "rgba(255,255,255,0.05)" }} />
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
        {!isLoading && (filtered?.length ?? 0) === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="h-14 w-14 rounded-full flex items-center justify-center mb-4 border"
              style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <Inbox className="h-6 w-6" style={{ color: "rgba(255,255,255,0.15)" }} />
            </div>
            <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
              No Records Found
            </p>
            <p className="text-xs mt-1 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.2)" }}>
              {hasFilters ? "Adjust filters to expand results" : "Calls assigned to you will appear here"}
            </p>
            {hasFilters && (
              <button
                className="mt-6 px-6 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
                onClick={() => { setStatusFilter("all"); setDateRange(undefined); setSearchQuery(""); }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Pagination */}
        <div
          className="px-8 py-4 border-t flex items-center justify-between"
          style={{
            background: "rgba(32,31,31,0.3)",
            borderColor: "rgba(255,255,255,0.03)",
          }}
        >
          <span
            className="text-[10px] uppercase tracking-widest"
            style={{ color: "#adaaaa" }}
          >
            Showing {Math.min((safePage - 1) * PAGE_SIZE + (paginated?.length ?? 0), filtered?.length ?? 0)} of {filtered?.length ?? 0} entries
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none"
                style={{ background: "rgba(255,255,255,0.05)", color: "#adaaaa" }}
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1">
                {visiblePages.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="w-8 h-8 rounded-xl text-[11px] font-bold transition-all"
                    style={
                      p === safePage
                        ? { background: "#22dbc6", color: "#00473f" }
                        : { color: "#adaaaa" }
                    }
                    onMouseEnter={(e) => {
                      if (p !== safePage) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
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
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none"
                style={{ background: "rgba(255,255,255,0.05)", color: "#adaaaa" }}
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
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
      style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
      onClick={onNavigate}
    >
      {/* Call ID */}
      <td className="px-6 py-4 font-mono text-xs" style={{ color: "#4ff5df" }}>
        #{call.call_id}
      </td>

      {/* Organization */}
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <span className="text-sm font-medium" style={{ color: "#ffffff" }}>
            {call.organization_name || "—"}
          </span>
          {call.rooftop_name && (
            <span className="text-[10px]" style={{ color: "#adaaaa" }}>
              {call.rooftop_name}
            </span>
          )}
        </div>
      </td>

      {/* Campaign */}
      <td className="px-6 py-4 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
        {call.campaign || "—"}
      </td>

      {/* Date */}
      <td className="px-6 py-4 text-sm" style={{ color: "#adaaaa" }}>
        {new Date(call.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })},{" "}
        {new Date(call.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
      </td>

      {/* Status pill */}
      <td className="px-6 py-4">
        <StatusPill status={ev.status} />
      </td>

      {/* Direction */}
      <td className="px-6 py-4">
        <DirectionIcon direction={call.direction} />
      </td>

      {/* Duration */}
      <td className="px-6 py-4 text-sm" style={{ color: "#adaaaa" }}>
        {formatDuration(call.duration)}
      </td>

      {/* NPS */}
      <td className="px-6 py-4 text-sm font-bold">
        {call.ai_nps_score !== null
          ? <NpsValue score={call.ai_nps_score} />
          : <span style={{ color: "#adaaaa" }}>--</span>
        }
      </td>

      {/* Action */}
      <td className="px-6 py-4">
        {ev.status === "pending" ? (
          <button
            className="px-4 py-1.5 text-[11px] font-bold rounded-full uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity active:scale-95"
            style={{ background: "#22dbc6", color: "#00473f" }}
            onClick={(e) => { e.stopPropagation(); onNavigate(); }}
          >
            Evaluate
          </button>
        ) : (
          <button
            className="px-4 py-1.5 text-[11px] font-bold rounded-full uppercase tracking-wider transition-colors active:scale-95"
            style={{ background: "rgba(255,255,255,0.05)", color: "#adaaaa" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
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
        className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase"
        style={{ background: "rgba(79,245,223,0.2)", color: "#4ff5df" }}
      >
        Completed
      </span>
    );
  }
  return (
    <span
      className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase"
      style={{ background: "rgba(234,179,8,0.2)", color: "#eab308" }}
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
    return <ArrowUpRight className="h-[18px] w-[18px]" style={{ color: "#adaaaa" }} />;
  }
  if (direction === "inbound") {
    return <ArrowDownLeft className="h-[18px] w-[18px]" style={{ color: "#adaaaa" }} />;
  }
  return <span style={{ color: "#adaaaa" }}>—</span>;
}

/* ──────────────────────────────────────────────────────────────────── */
/*  NPS value                                                           */
/* ──────────────────────────────────────────────────────────────────── */

function NpsValue({ score }: { score: number }) {
  const color = score >= 9 ? "#4ff5df" : score >= 7 ? "#eab308" : "#ff716c";
  return <span style={{ color }}>{score}</span>;
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Duration formatter                                                  */
/* ──────────────────────────────────────────────────────────────────── */

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
