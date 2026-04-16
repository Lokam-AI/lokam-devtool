import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiGetAllCalls, apiGetAllCallsCount } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  ChevronLeft,
  ChevronRight,
  Inbox,
  PhoneCall,
  Timer,
  Star,
  Zap,
  Download,
  SlidersHorizontal,
} from "lucide-react";
import type { RawCall } from "@/types";

const PAGE_SIZE = 50;

export default function AllCallsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [envFilter, setEnvFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);

  const queryParams = useMemo(() => ({
    source_env:  envFilter   !== "all" ? envFilter   : undefined,
    call_status: statusFilter !== "all" ? statusFilter : undefined,
    limit:  PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }), [statusFilter, envFilter, page]);

  const countParams = useMemo(() => ({
    source_env:  envFilter   !== "all" ? envFilter   : undefined,
    call_status: statusFilter !== "all" ? statusFilter : undefined,
  }), [statusFilter, envFilter]);

  const { data: calls, isLoading } = useQuery({
    queryKey: ["all-calls", queryParams],
    queryFn: () => apiGetAllCalls(queryParams),
  });

  const { data: totalCount } = useQuery({
    queryKey: ["all-calls-count", countParams],
    queryFn: () => apiGetAllCallsCount(countParams),
  });

  const filtered = useMemo(() => {
    if (!calls) return [];
    if (!searchQuery) return calls;
    const q = searchQuery.toLowerCase();
    return calls.filter((c) =>
      c.call_id.toLowerCase().includes(q) ||
      c.campaign.toLowerCase().includes(q) ||
      c.organization_name.toLowerCase().includes(q) ||
      c.rooftop_name.toLowerCase().includes(q) ||
      c.customer_phone.toLowerCase().includes(q)
    );
  }, [calls, searchQuery]);

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

  const completedCount = useMemo(
    () => calls?.filter((c) => c.call_status === "Completed").length ?? 0,
    [calls]
  );

  const totalPages = totalCount ? Math.ceil(totalCount / PAGE_SIZE) : 0;
  const hasFilters  = statusFilter !== "all" || envFilter !== "all" || searchQuery;

  const resetFilters = () => {
    setStatusFilter("all");
    setEnvFilter("all");
    setSearchQuery("");
    setPage(0);
  };

  const visiblePages = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i);
    if (page < 3) return [0, 1, 2, 3, 4];
    if (page >= totalPages - 3) return [totalPages - 5, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1];
    return [page - 2, page - 1, page, page + 1, page + 2];
  }, [page, totalPages]);

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">

      {/* ── Page title row ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-[0.02em]" style={{ color: "#ffffff" }}>
            All Calls
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#adaaaa" }}>
            Complete record of all call interactions across every environment.
          </p>
        </div>
        {/* Search — inline in header area */}
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full border"
          style={{ background: "#000000", borderColor: "rgba(73,72,71,0.1)" }}
        >
          <Search className="h-4 w-4 shrink-0" style={{ color: "#adaaaa" }} />
          <input
            className="bg-transparent border-none text-sm focus:outline-none w-64"
            style={{ color: "#ffffff" }}
            placeholder="Search by ID or Organization..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
          />
        </div>
      </div>

      {/* ── Metric cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {/* Total Calls — aurora glow */}
        <MetricCard
          label="Total Calls"
          value={totalCount !== undefined ? totalCount.toLocaleString() : "—"}
          badge={{ text: "+12%", color: "#4ff5df" }}
          icon={<PhoneCall className="h-[18px] w-[18px]" style={{ color: "#4ff5df" }} />}
          loading={false}
          aurora
        />
        <MetricCard
          label="Avg Duration"
          value={isLoading ? "—" : formatDuration(avgDuration)}
          badge={{ text: "Stable", color: "#adaaaa" }}
          icon={<Timer className="h-[18px] w-[18px]" style={{ color: "#afefdd" }} />}
          loading={isLoading}
        />
        <MetricCard
          label="Avg NPS"
          value={isLoading ? "—" : (avgNps ?? "N/A")}
          badge={{
            text: avgNps && parseFloat(avgNps) < 7 ? "-0.2" : "Optimal",
            color: avgNps && parseFloat(avgNps) < 7 ? "#d7383b" : "#4ff5df",
          }}
          icon={<Star className="h-[18px] w-[18px]" style={{ color: "#d6fff6" }} />}
          loading={isLoading}
        />
        <MetricCard
          label="Active Sessions"
          value={isLoading ? "—" : completedCount.toString()}
          badge={{ text: "Live", color: "#4ff5df" }}
          icon={<Zap className="h-[18px] w-[18px]" style={{ color: "#39e6d1" }} />}
          loading={isLoading}
        />
      </div>

      {/* ── Table controls ───────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status filter */}
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-colors"
            style={{ background: "#131313", borderColor: "rgba(73,72,71,0.1)" }}
          >
            <select
              className="bg-transparent border-none text-sm font-medium focus:outline-none cursor-pointer"
              style={{ color: "#ffffff" }}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            >
              <option value="all"       style={{ background: "#1c1c1e" }}>Status: All</option>
              <option value="Completed" style={{ background: "#1c1c1e" }}>Status: Completed</option>
              <option value="Missed"    style={{ background: "#1c1c1e" }}>Status: Missed</option>
            </select>
          </div>

          {/* Env filter */}
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-colors"
            style={{ background: "#131313", borderColor: "rgba(73,72,71,0.1)" }}
          >
            <select
              className="bg-transparent border-none text-sm font-medium focus:outline-none cursor-pointer"
              style={{ color: "#ffffff" }}
              value={envFilter}
              onChange={(e) => { setEnvFilter(e.target.value); setPage(0); }}
            >
              <option value="all"        style={{ background: "#1c1c1e" }}>Env: All</option>
              <option value="playground" style={{ background: "#1c1c1e" }}>Playground</option>
              <option value="staging"    style={{ background: "#1c1c1e" }}>Staging</option>
              <option value="prod"       style={{ background: "#1c1c1e" }}>Production</option>
            </select>
          </div>

          {hasFilters && (
            <button
              className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
              style={{ color: "#adaaaa" }}
              onMouseEnter={(e) => { (e.currentTarget).style.color = "#ffffff"; }}
              onMouseLeave={(e) => { (e.currentTarget).style.color = "#adaaaa"; }}
              onClick={resetFilters}
            >
              Clear
            </button>
          )}
        </div>

        {/* Right icon actions */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-widest mr-2" style={{ color: "rgba(173,170,170,0.4)" }}>
            {totalCount !== undefined
              ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalCount)} of ${totalCount.toLocaleString()}`
              : "—"
            }
          </span>
          <button
            className="p-2 rounded-lg transition-colors"
            style={{ background: "#131313", color: "#adaaaa" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ffffff"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#adaaaa"; }}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <button
            className="p-2 rounded-lg transition-colors"
            style={{ background: "#131313", color: "#adaaaa" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ffffff"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#adaaaa"; }}
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl overflow-hidden border flex flex-col"
        style={{
          background: "#1c1c1e",
          borderColor: "rgba(73,72,71,0.05)",
          boxShadow: "0px 24px 48px rgba(0,0,0,0.5)",
        }}
      >
        <ScrollArea>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "rgba(32,31,31,0.5)" }}>
                {["Call ID", "Organization", "Campaign", "Date", "Status", "Direction", "Duration", "NPS", ""].map((h) => (
                  <th
                    key={h}
                    className={`px-6 py-5 text-[10px] font-bold uppercase tracking-[0.1em] whitespace-nowrap ${h === "Duration" || h === "NPS" ? "text-center" : ""} ${h === "" ? "text-right" : ""}`}
                    style={{ color: "#adaaaa" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(73,72,71,0.05)" }}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-6 py-5">
                          <Skeleton className="h-3.5 w-16" style={{ background: "rgba(255,255,255,0.05)" }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : filtered.map((call) => (
                    <CallRow key={call.id} call={call} onView={() => navigate(`/eval/${call.id}`)} />
                  ))
              }
            </tbody>
          </table>
        </ScrollArea>

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
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
              {hasFilters ? "Adjust filters to expand results" : "No calls in the database yet"}
            </p>
            {hasFilters && (
              <button
                className="mt-6 px-6 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                onClick={resetFilters}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Pagination */}
        <div
          className="flex items-center justify-between px-6 py-4 border-t"
          style={{
            background: "rgba(32,31,31,0.3)",
            borderColor: "rgba(73,72,71,0.05)",
          }}
        >
          <span className="text-xs font-medium" style={{ color: "#adaaaa" }}>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount ?? 0)} of {totalCount?.toLocaleString() ?? "—"} calls
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
                style={{ background: "#131313", color: "#adaaaa" }}
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1">
                {visiblePages.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
                    style={
                      p === page
                        ? { background: "#4ff5df", color: "#00594f" }
                        : { background: "#131313", color: "#adaaaa" }
                    }
                    onMouseEnter={(e) => {
                      if (p !== page) (e.currentTarget as HTMLButtonElement).style.color = "#ffffff";
                    }}
                    onMouseLeave={(e) => {
                      if (p !== page) (e.currentTarget as HTMLButtonElement).style.color = "#adaaaa";
                    }}
                  >
                    {p + 1}
                  </button>
                ))}
                {totalPages > 5 && page < totalPages - 4 && (
                  <>
                    <span className="text-xs px-1" style={{ color: "#adaaaa" }}>…</span>
                    <button
                      onClick={() => setPage(totalPages - 1)}
                      className="px-3 py-1 rounded-lg text-xs font-bold transition-colors"
                      style={{ background: "#131313", color: "#adaaaa" }}
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>
              <button
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
                style={{ background: "#131313", color: "#adaaaa" }}
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
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
/*  Metric card                                                         */
/* ──────────────────────────────────────────────────────────────────── */

function MetricCard({
  label,
  value,
  badge,
  icon,
  loading,
  aurora,
}: {
  label: string;
  value: string;
  badge: { text: string; color: string };
  icon: React.ReactNode;
  loading: boolean;
  aurora?: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl p-5 border"
      style={{
        background: "#1c1c1e",
        borderColor: "rgba(73,72,71,0.05)",
        boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
      }}
    >
      {aurora && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: "-20px", left: "-20px", right: "-20px", bottom: "-20px",
            background: "radial-gradient(circle at center, rgba(79,245,223,0.08) 0%, transparent 70%)",
            filter: "blur(40px)",
            zIndex: 0,
          }}
        />
      )}
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-2">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.05em]"
            style={{ color: "#adaaaa" }}
          >
            {label}
          </span>
          {icon}
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          {loading ? (
            <Skeleton className="h-9 w-20" style={{ background: "rgba(255,255,255,0.05)" }} />
          ) : (
            <span className="text-3xl font-black tracking-tight" style={{ color: "#ffffff" }}>
              {value}
            </span>
          )}
          {!loading && (
            <span className="text-xs font-medium" style={{ color: badge.color }}>
              {badge.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Call row                                                            */
/* ──────────────────────────────────────────────────────────────────── */

function CallRow({ call, onView }: { call: RawCall; onView: () => void }) {
  const initials = call.organization_name
    ? call.organization_name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <tr
      className="group cursor-pointer transition-colors"
      style={{ borderBottom: "1px solid rgba(73,72,71,0.05)" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#262626"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
      onClick={onView}
    >
      {/* Call ID */}
      <td className="px-6 py-5 font-mono text-sm font-bold" style={{ color: "#4ff5df" }}>
        #{call.call_id}
      </td>

      {/* Organization with letter avatar */}
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border text-[10px] font-bold"
            style={{ background: "#000000", borderColor: "rgba(73,72,71,0.1)", color: "#4ff5df" }}
          >
            {initials}
          </div>
          <div>
            <span className="text-sm font-semibold" style={{ color: "#ffffff" }}>
              {call.organization_name || "—"}
            </span>
            {call.rooftop_name && (
              <p className="text-[10px] mt-0.5" style={{ color: "#adaaaa" }}>
                {call.rooftop_name}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Campaign */}
      <td className="px-6 py-5 text-sm" style={{ color: "#adaaaa" }}>
        {call.campaign || "—"}
      </td>

      {/* Date */}
      <td className="px-6 py-5 text-sm" style={{ color: "#adaaaa" }}>
        {new Date(call.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })},{" "}
        {new Date(call.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
      </td>

      {/* Status */}
      <td className="px-6 py-5">
        <CallStatusBadge status={call.call_status} />
      </td>

      {/* Direction */}
      <td className="px-6 py-5">
        <DirectionIndicator direction={call.direction} />
      </td>

      {/* Duration */}
      <td className="px-6 py-5 text-sm text-center" style={{ color: "#adaaaa" }}>
        {formatDuration(call.duration)}
      </td>

      {/* NPS */}
      <td className="px-6 py-5 text-center">
        {call.ai_nps_score !== null
          ? <NpsValue score={call.ai_nps_score} />
          : <span className="text-sm font-bold" style={{ color: "#adaaaa" }}>--</span>
        }
      </td>

      {/* Action */}
      <td className="px-6 py-5 text-right">
        <ViewButton onView={(e) => { e.stopPropagation(); onView(); }} />
      </td>
    </tr>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  View button — border + hover fill                                   */
/* ──────────────────────────────────────────────────────────────────── */

function ViewButton({ onView }: { onView: (e: React.MouseEvent) => void }) {
  return (
    <button
      className="px-4 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95"
      style={{ background: "#262626", color: "#4ff5df", borderColor: "rgba(79,245,223,0.1)" }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = "#4ff5df";
        el.style.color = "#00594f";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = "#262626";
        el.style.color = "#4ff5df";
      }}
      onClick={onView}
    >
      View
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Status badge                                                        */
/* ──────────────────────────────────────────────────────────────────── */

function CallStatusBadge({ status }: { status: string }) {
  if (status === "Completed") {
    return (
      <span
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
        style={{ background: "#0b5345", color: "#a1e1cf" }}
      >
        Completed
      </span>
    );
  }
  if (status === "Missed") {
    return (
      <span
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
        style={{ background: "rgba(159,5,25,0.2)", color: "#ff716c" }}
      >
        Missed
      </span>
    );
  }
  // In Progress / other
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ background: "#4ff5df" }}
      />
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#4ff5df" }}>
        {status || "Unknown"}
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Direction indicator                                                 */
/* ──────────────────────────────────────────────────────────────────── */

function DirectionIndicator({ direction }: { direction: string }) {
  if (direction === "outbound") {
    return <ArrowUpRight className="h-[18px] w-[18px]" style={{ color: "#adaaaa" }} />;
  }
  if (direction === "inbound") {
    return <ArrowDownLeft className="h-[18px] w-[18px]" style={{ color: "#adaaaa" }} />;
  }
  return <span className="text-sm" style={{ color: "#adaaaa" }}>—</span>;
}

/* ──────────────────────────────────────────────────────────────────── */
/*  NPS value                                                           */
/* ──────────────────────────────────────────────────────────────────── */

function NpsValue({ score }: { score: number }) {
  const color = score >= 9 ? "#4ff5df" : score >= 7 ? "#eab308" : "#ff716c";
  return <span className="text-sm font-bold" style={{ color }}>{score}</span>;
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Duration formatter                                                  */
/* ──────────────────────────────────────────────────────────────────── */

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
