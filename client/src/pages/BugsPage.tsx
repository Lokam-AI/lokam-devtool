import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Bug, Building2, MapPin, Tag, AlertTriangle, RefreshCw, Filter, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useBugs, useBugsCount, useBugsStats, useAssignBug, useResolveBug, useUsers } from "@/hooks/use-calls";
import { apiGetBugs, apiGetBug } from "@/lib/api";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { BugDetailDrawer } from "@/components/bugs/BugDetailDrawer";
import type { BugReport } from "@/types";
import { parseUtc } from "@/lib/utils";

const FF = '"cv01", "ss03"' as const;

function thisMonthRange(): DateRange {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { from, to };
}

function toIso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return parseUtc(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function mostCommonBugType(bugs: BugReport[]): string {
  const counts: Record<string, number> = {};
  for (const b of bugs) {
    for (const t of b.bug_types ?? []) {
      counts[t] = (counts[t] ?? 0) + 1;
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? "—";
}

/* ── Metric Card ─────────────────────────────────────────────────── */
function MetricCard({ icon: Icon, label, value, accent = false }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-2"
      style={{ background: "#191a1b", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: accent ? "#7170ff" : "#62666d" }} />
        <span className="text-[12px] leading-none" style={{ color: "#62666d", fontWeight: 400, fontFeatureSettings: FF }}>
          {label}
        </span>
      </div>
      <span
        className="text-[28px] leading-none tabular-nums"
        style={{ color: accent ? "#7170ff" : "#f7f8f8", fontWeight: 510, letterSpacing: "-0.5px", fontFeatureSettings: FF }}
      >
        {value}
      </span>
    </div>
  );
}

/* ── Bug Type Chip ───────────────────────────────────────────────── */
export function BugTypeChip({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] leading-none"
      style={{
        background: "rgba(113,112,255,0.1)",
        border: "1px solid rgba(113,112,255,0.2)",
        color: "#7170ff",
        fontWeight: 510,
        fontFeatureSettings: FF,
      }}
    >
      {label}
    </span>
  );
}

const PAGE_SIZE = 15;
const STALE_MS = 5 * 60 * 1000;

/* ── Main Page ───────────────────────────────────────────────────── */
export default function BugsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [range, setRange] = useState<DateRange | undefined>(thisMonthRange);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "internal" | "clients">("all");
  const [orgFilter, setOrgFilter] = useState<string>("");
  const [bugTypeFilter, setBugTypeFilter] = useState<string>("");
  const [mentionedMe, setMentionedMe] = useState(false);
  const [selected, setSelected] = useState<BugReport | null>(null);
  const openIdParam = searchParams.get("open");
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [range, statusFilter, sourceFilter, orgFilter, bugTypeFilter, mentionedMe]);

  const dateFrom = range?.from ? toIso(range.from) : "";
  const dateTo   = range?.to   ? toIso(range.to)   : dateFrom;

  const filterBase = useMemo(() => ({
    date_from:         dateFrom,
    date_to:           dateTo,
    organization_name: orgFilter || undefined,
    is_resolved:       statusFilter === "open" ? false : statusFilter === "resolved" ? true : undefined,
    bug_type:          bugTypeFilter || undefined,
    is_internal:       sourceFilter === "internal" ? true : sourceFilter === "clients" ? false : undefined,
    mentioned_me:      mentionedMe || undefined,
  }), [dateFrom, dateTo, orgFilter, statusFilter, bugTypeFilter, sourceFilter, mentionedMe]);

  const bugsParams = useMemo(() => ({
    ...filterBase,
    limit:  PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }), [filterBase, page]);

  const statsParams = useMemo(() => ({
    date_from:         dateFrom,
    date_to:           dateTo,
    organization_name: orgFilter || undefined,
    bug_type:          bugTypeFilter || undefined,
  }), [dateFrom, dateTo, orgFilter, bugTypeFilter]);

  const countParams = useMemo(() => ({
    date_from:         dateFrom,
    date_to:           dateTo,
    organization_name: orgFilter || undefined,
    is_resolved:       statusFilter === "open" ? false : statusFilter === "resolved" ? true : undefined,
    bug_type:          bugTypeFilter || undefined,
  }), [dateFrom, dateTo, orgFilter, statusFilter, bugTypeFilter]);

  const { data: bugs = [], isLoading, isFetching, refetch } = useBugs(bugsParams);
  const { data: totalCount = 0 } = useBugsCount(countParams);
  const { data: bugStats } = useBugsStats(statsParams);

  const qc = useQueryClient();
  useEffect(() => {
    const nextParams = { ...bugsParams, offset: (page + 1) * PAGE_SIZE };
    qc.prefetchQuery({ queryKey: ["bugs", nextParams], queryFn: () => apiGetBugs(nextParams), staleTime: STALE_MS });
  }, [bugsParams]);

  // Auto-open drawer from notification deep-link (?open=<bug_id>) — fetches directly so date filter doesn't matter
  useEffect(() => {
    if (!openIdParam) return;
    const bugId = Number(openIdParam);
    if (!bugId) return;
    // Clear the param immediately so re-renders don't re-trigger
    setSearchParams((prev) => { prev.delete("open"); return prev; }, { replace: true });
    // Try the already-loaded list first to avoid an extra request
    const inList = bugs.find((b) => b.id === bugId);
    if (inList) { setSelected(inList); return; }
    // Fall back to a direct fetch — works regardless of current date filter
    apiGetBug(bugId).then(setSelected).catch(() => {});
  }, [openIdParam]);

  const { data: users = [] } = useUsers();
  const assignBug = useAssignBug();
  const resolveBug = useResolveBug();

  const orgOptions     = useMemo(() => Array.from(new Set(bugs.map((b) => b.organization_name).filter(Boolean) as string[])).sort(), [bugs]);
  const bugTypeOptions = useMemo(() => Array.from(new Set(bugs.flatMap((b) => b.bug_types ?? []))).sort(), [bugs]);


  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const activeFilterCount = [statusFilter !== "all", sourceFilter !== "all", !!orgFilter, !!bugTypeFilter, mentionedMe].filter(Boolean).length;


  // Keep drawer in sync when list refreshes
  const selectedLive = selected ? (bugs.find((b) => b.id === selected.id) ?? selected) : null;

  return (
    <div
      className="min-h-screen p-6 space-y-6"
      style={{ background: "#0f1011", fontFamily: "Inter Variable, system-ui, sans-serif" }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-[22px] leading-none mb-1"
            style={{ color: "#f7f8f8", fontWeight: 510, letterSpacing: "-0.3px", fontFeatureSettings: FF }}
          >
            Bug Reports
          </h1>
          <p className="text-[13px]" style={{ color: "#62666d", fontFeatureSettings: FF }}>
            Synced from production environments
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <DateRangePicker value={range} onChange={setRange} />

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 flex items-center gap-1.5 rounded-md px-3 text-[13px] transition-colors"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#8a8f98",
              fontFeatureSettings: FF,
            }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5" style={{ color: activeFilterCount > 0 ? "#7170ff" : "#62666d" }}>
          <Filter className="h-3.5 w-3.5 shrink-0" />
          <span className="text-[12px]" style={{ fontWeight: 510, fontFeatureSettings: FF }}>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </span>
        </div>

        {/* Status */}
        {(["all", "open", "resolved"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="h-7 px-2.5 rounded-md text-[12px] capitalize transition-colors"
            style={statusFilter === s
              ? { background: "rgba(113,112,255,0.12)", border: "1px solid rgba(113,112,255,0.25)", color: "#7170ff", fontWeight: 510, fontFeatureSettings: FF }
              : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#8a8f98", fontFeatureSettings: FF }
            }
          >
            {s}
          </button>
        ))}

        {/* Divider */}
        <div className="h-4 w-px mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Source */}
        {(["all", "internal", "clients"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSourceFilter(s)}
            className="h-7 px-2.5 rounded-md text-[12px] capitalize transition-colors"
            style={sourceFilter === s
              ? { background: "rgba(113,112,255,0.12)", border: "1px solid rgba(113,112,255,0.25)", color: "#7170ff", fontWeight: 510, fontFeatureSettings: FF }
              : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#8a8f98", fontFeatureSettings: FF }
            }
          >
            {s}
          </button>
        ))}

        {/* Divider */}
        <div className="h-4 w-px mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Mentioned me */}
        <button
          onClick={() => setMentionedMe((v) => !v)}
          className="h-7 px-2.5 rounded-md text-[12px] flex items-center gap-1.5 transition-colors"
          style={mentionedMe
            ? { background: "rgba(113,112,255,0.12)", border: "1px solid rgba(113,112,255,0.25)", color: "#7170ff", fontWeight: 510, fontFeatureSettings: FF }
            : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#8a8f98", fontFeatureSettings: FF }
          }
        >
          <span style={{ fontSize: 11 }}>@</span>
          Mentioned me
        </button>

        {/* Divider */}
        <div className="h-4 w-px mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Org filter */}
        {orgOptions.length > 0 && (
          <DropdownSelect
            value={orgFilter}
            onChange={setOrgFilter}
            options={[
              { value: "", label: "All orgs" },
              ...orgOptions.map((o) => ({ value: o, label: o })),
            ]}
            size="sm"
          />
        )}

        {/* Bug type filter */}
        {bugTypeOptions.length > 0 && (
          <DropdownSelect
            value={bugTypeFilter}
            onChange={setBugTypeFilter}
            options={[
              { value: "", label: "All bug types" },
              ...bugTypeOptions.map((t) => ({ value: t, label: t })),
            ]}
            size="sm"
          />
        )}

        {/* Clear all */}
        {activeFilterCount > 0 && (
          <button
            onClick={() => { setStatusFilter("all"); setSourceFilter("all"); setOrgFilter(""); setBugTypeFilter(""); setMentionedMe(false); }}
            className="h-7 px-2 text-[12px] flex items-center gap-1 rounded-md transition-colors"
            style={{ color: "#62666d", fontFeatureSettings: FF }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ff716c"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#62666d"; }}
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}

        {/* Result count */}
        <span className="ml-auto text-[12px]" style={{ color: "#62666d", fontFeatureSettings: FF }}>
          {totalCount > 0 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalCount)} of ${totalCount}` : "0 results"}
        </span>
      </div>

      {/* ── Metric cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard icon={Bug}       label="Total Bugs"      value={bugStats?.total_bugs ?? "—"} accent />
        <MetricCard icon={Building2} label="Unique Orgs"     value={bugStats?.unique_orgs ?? "—"} />
        <MetricCard icon={MapPin}    label="Unique Rooftops" value={bugStats?.unique_rooftops ?? "—"} />
        <MetricCard icon={Tag}       label="Top Bug Type"    value={bugStats?.top_bug_type ?? "—"} />
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div
          className="grid text-[11px] px-4 py-2.5"
          style={{
            gridTemplateColumns: "60px 1fr 1fr 160px 1fr 80px 100px 120px",
            background: "#141516",
            color: "#62666d",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            fontWeight: 510,
            letterSpacing: "0.04em",
            fontFeatureSettings: FF,
            textTransform: "uppercase",
          }}
        >
          <span>ID</span>
          <span>Organization</span>
          <span>Rooftop</span>
          <span>Bug Types</span>
          <span>Reporter</span>
          <span>Date</span>
          <span>Status</span>
          <span>Time</span>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16" style={{ background: "#191a1b" }}>
            <div
              className="h-5 w-5 rounded-full border-2 animate-spin"
              style={{ borderColor: "rgba(113,112,255,0.3)", borderTopColor: "#7170ff" }}
            />
          </div>
        )}

        {!isLoading && bugs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ background: "#191a1b" }}>
            <AlertTriangle className="h-8 w-8" style={{ color: "#34343a" }} />
            <p className="text-[13px]" style={{ color: "#62666d", fontFeatureSettings: FF }}>
              No bug reports for the selected range
            </p>
          </div>
        )}

        {!isLoading && bugs.map((bug, idx) => (
          <BugRow
            key={bug.id}
            bug={bug}
            even={idx % 2 === 0}
            active={selected?.id === bug.id}
            onClick={() => setSelected(bug)}
          />
        ))}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="px-4 py-3 flex items-center justify-between border-t"
            style={{ borderColor: "rgba(255,255,255,0.05)", background: "#141516" }}
          >
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="w-7 h-7 rounded-md flex items-center justify-center border disabled:opacity-30 transition-colors"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)", color: "#8a8f98" }}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[12px]" style={{ color: "#62666d", fontFeatureSettings: FF }}>
              Page {page + 1} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="w-7 h-7 rounded-md flex items-center justify-center border disabled:opacity-30 transition-colors"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)", color: "#8a8f98" }}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── Detail drawer ──────────────────────────────────────── */}
      <BugDetailDrawer
        bug={selectedLive}
        users={users}
        canAssign
        onClose={() => setSelected(null)}
        onAssign={(userId) => {
          if (!selectedLive) return;
          assignBug.mutate({ bugId: selectedLive.id, userId });
        }}
        onResolve={(isResolved) => {
          if (!selectedLive) return;
          resolveBug.mutate({ bugId: selectedLive.id, isResolved });
        }}
        assigning={assignBug.isPending}
        resolving={resolveBug.isPending}
      />
    </div>
  );
}

function BugRow({ bug, even, active, onClick }: {
  bug: BugReport; even: boolean; active: boolean; onClick: () => void;
}) {
  return (
    <div
      className="grid items-start px-4 py-3 text-[13px] cursor-pointer transition-colors"
      style={{
        gridTemplateColumns: "60px 1fr 1fr 160px 1fr 80px 100px 120px",
        background: active ? "rgba(113,112,255,0.07)" : even ? "#191a1b" : "rgba(255,255,255,0.01)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        borderLeft: active ? "2px solid #7170ff" : "2px solid transparent",
        fontFeatureSettings: FF,
      }}
      onClick={onClick}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = even ? "#191a1b" : "rgba(255,255,255,0.01)"; }}
    >
      <span style={{ color: "#62666d", fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace", fontSize: "11px" }}>
        #{bug.external_id}
      </span>

      <div>
        <span style={{ color: "#d0d6e0", fontWeight: 400 }}>{bug.organization_name ?? "—"}</span>
        {bug.source_env && (
          <span
            className="ml-2 text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#8a8f98" }}
          >
            {bug.source_env}
          </span>
        )}
      </div>

      <span style={{ color: "#8a8f98" }}>{bug.rooftop_name ?? "—"}</span>

      <div className="flex flex-wrap gap-1">
        {(bug.bug_types ?? []).length > 0
          ? bug.bug_types!.map((t) => <BugTypeChip key={t} label={t} />)
          : <span style={{ color: "#3e3e44" }}>—</span>
        }
      </div>

      <span style={{ color: "#8a8f98" }}>
        {bug.submitted_by_name ?? (bug.submitted_by ? `#${bug.submitted_by}` : "—")}
      </span>

      <span style={{ color: "#62666d", fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace", fontSize: "11px" }}>
        {bug.bug_date}
      </span>

      <span>
        {bug.is_resolved
          ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
              style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", fontWeight: 510 }}
            >
              ✓ Resolved
            </span>
          )
          : (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px]"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#62666d", fontWeight: 400 }}
            >
              Open
            </span>
          )
        }
      </span>

      <span style={{ color: "#62666d", fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace", fontSize: "11px" }}>
        {formatDate(bug.external_created_at)}
      </span>
    </div>
  );
}
